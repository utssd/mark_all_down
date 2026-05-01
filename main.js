const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');
const net = require('net');
const { createClient: createWebdavClient } = require('./vendors/webdav');
const { Client: SshClient } = require('./vendors/ssh2');
const crypto = require('crypto');
const { AgentManager } = require('./agents/_runtime/manager.js');
const { scanSync: scanAgents } = require('./agents/_runtime/loader.js');
const { CloudAgentSession } = require('./agents/_cloud/client.js');
const { startMonitor, tryBumpFdLimit } = require('./monitor.js');

// Raise the soft fd limit BEFORE Electron forks the zygote. The monitor
// used to bump this after app.whenReady() which was too late — zygote
// already forked with the default 1024 and every renderer inherited it.
// Linux-only; no-op elsewhere. Result is reported later by startMonitor().
const _bootRlimit = tryBumpFdLimit();

let _monitorHandle = null;

// ── Agent worker process ────────────────────────────────────────────────────
let _worker = null;
let _workerReady = false;
let _appQuitting = false;
const _pendingRuns = new Map(); // runId → { agentId, resolve }

// ── Smart RSS worker supervisor ───────────────────────────────────────
let _smartRssProc = null;
let _smartRssReady = null;
let _smartRssMsgId = 0;
const _smartRssPending = new Map();

function startSmartRssWorker() {
  if (_smartRssProc) return _smartRssReady;
  const dataDir = path.join(app.getPath('userData'), 'rss');
  _smartRssProc = fork(
    path.join(__dirname, 'agents', '_runtime', 'smart-rss', 'worker.js'),
    [],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', SMART_RSS_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }
  );
  _smartRssProc.stdout?.on('data', (d) => console.log('[smart-rss]', d.toString().trim()));
  _smartRssProc.stderr?.on('data', (d) => console.error('[smart-rss]', d.toString().trim()));
  _smartRssReady = new Promise((resolve, reject) => {
    _smartRssProc.once('message', (msg) => {
      if (msg && msg.ready) resolve();
    });
    _smartRssProc.once('exit', () => reject(new Error('smart-rss worker exited before ready')));
  });
  _smartRssProc.on('message', (msg) => {
    if (!msg || msg.ready || typeof msg.id !== 'number') return;
    const pending = _smartRssPending.get(msg.id);
    if (!pending) return;
    _smartRssPending.delete(msg.id);
    if (msg.ok) pending.resolve(msg.result);
    else pending.reject(new Error(msg.error));
  });
  _smartRssProc.on('exit', (code) => {
    console.warn('[smart-rss] worker exited', code);
    _smartRssProc = null;
    _smartRssReady = null;
    for (const p of _smartRssPending.values()) p.reject(new Error('worker exited'));
    _smartRssPending.clear();
  });
  return _smartRssReady;
}

async function smartRssCall(type, payload) {
  await startSmartRssWorker();
  return new Promise((resolve, reject) => {
    const id = ++_smartRssMsgId;
    _smartRssPending.set(id, { resolve, reject });
    _smartRssProc.send({ id, type, payload });
  });
}

function spawnWorker() {
  if (_worker) {
    try {
      _worker.kill();
    } catch (_) {}
    _worker = null;
    _workerReady = false;
  }
  _worker = fork(path.join(__dirname, 'agents', '_runtime', 'worker.js'), [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  _worker.stdout?.on('data', (d) => console.log('[worker]', d.toString().trim()));
  _worker.stderr?.on('data', (d) => console.error('[worker]', d.toString().trim()));
  _worker.on('message', async (msg) => {
    if (msg.type === 'ready') {
      _workerReady = true;
      return;
    }
    // Worker requests a WebDAV save via main process (fresh tunnel + settings)
    if (msg.type === 'webdav:save') {
      handleWorkerWebdavSave(msg);
      return;
    }
    // Worker requests a WebDAV read via main process (fresh tunnel + settings)
    if (msg.type === 'webdav:read') {
      handleWorkerWebdavRead(msg);
      return;
    }
    // Worker asks the renderer to open a WebDAV file in the main viewer.
    // Gated on the agent declaring `capabilities.pages` in its AGENT.md —
    // otherwise a rogue agent could hijack the main window.
    if (msg.type === 'open:webdavFile') {
      const manifest = agentManager.getManifest(msg.agentId);
      if (!manifest?.capabilities?.pages) {
        console.warn(
          `agent ${msg.agentId || '(unknown)'} requested open:webdavFile without capabilities.pages — ignored`
        );
        return;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:openWebdavFile', { filePath: msg.filePath });
      }
      return;
    }
    const { runId, ...rest } = msg;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:progress', rest);
    }
    if (msg.type === 'done' || msg.type === 'error') {
      _pendingRuns.get(runId)?.resolve(msg);
      _pendingRuns.delete(runId);
    }
  });
  _worker.on('exit', () => {
    _workerReady = false;
    _worker = null;
    for (const [, { agentId }] of _pendingRuns) {
      agentManager.markFinished(agentId, 'error', 'Worker crashed');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:progress', {
          type: 'error',
          agentId,
          message: 'Agent worker crashed unexpectedly.',
        });
      }
    }
    _pendingRuns.clear();
    if (!_appQuitting) setTimeout(spawnWorker, 1000);
  });
  _worker.on('error', (err) => console.error('[worker] spawn error:', err.message));
}

// ── Pages mode cache ────────────────────────────────────────────────────────
let _pagesConfigCache = {}; // { [pagesRoot]: siteData object }
let _pagesLayoutCache = {}; // { [absolutePath]: string | null }
let _pagesIncludeCache = {}; // { [absolutePath]: string }

let mainWindow = null;
let pendingFilePath = null;

const SUPPORTED_EXTENSIONS = [
  '.md', '.markdown', '.txt',
  '.pdf',
  '.json', '.yaml', '.yml', '.xml', '.csv', '.log',
  '.ini', '.toml', '.conf', '.cfg', '.env', '.properties',
  '.sh', '.bash', '.zsh', '.py', '.js', '.ts', '.html', '.css',
];

const LARGE_FILE_WARN_BYTES = 5 * 1024 * 1024;    // 5 MB — show confirmation dialog
const LARGE_FILE_MAX_BYTES  = 200 * 1024 * 1024;   // 200 MB — refuse to open

// WebDAV Pages / Open Remote browser — keep in sync with PAGES_SUPPORTED_EXTENSIONS in app.js
const WEBDAV_PAGES_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.jpe',
  '.jfif',
];

const WEBDAV_BINARY_IMAGE_EXT_TO_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

/** WebDAV list: extension match, plus MIME when servers omit or mangle extensions in basename. */
function webdavPagesListAcceptsItem(item) {
  if (item.type === 'directory') return true;
  // Prefer path leaf from `filename` — some servers misreport `basename` but href/filename is correct.
  const leaf = (item.filename && path.basename(item.filename)) || String(item.basename || '').trim();
  const ext = path.extname(leaf).toLowerCase();
  if (WEBDAV_PAGES_EXTENSIONS.includes(ext)) return true;
  const mime = String(item.mime || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/json' || mime === 'text/json') return true;
  return false;
}
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const TRACKER_DIR = () => path.join(app.getPath('userData'), 'tracker');
const TRACKER_INDEX = () => path.join(TRACKER_DIR(), 'index.json');

// ── Cloud state (never written to disk) ────────────────────────────────────
let _fekInMemory = null; // Buffer(32) while logged in, null otherwise

const CLOUD_DEFAULTS = {
  apiBaseUrl: '',
  email: '',
  accessToken: '',
  tokenExpiresAt: '',
  refreshToken: '',
  encryptedFek: '',
  fekIv: '',
  fekSalt: '',
  userId: '',
};

const CLOUD_AGENTS_DEFAULTS = {
  apiBaseUrl: '',
  baseUrl: 'http://localhost:8787',
  token: '',
  executionMode: 'local', // 'local' | 'cloud' — master keeps both paths; open_source forces 'cloud'
};

const SSH_TUNNEL_DEFAULTS = {
  enabled: false,
  host: '',
  port: 22,
  username: '',
  privateKeyPath: '',
  passphrase: '',
};
const WEBDAV_DEFAULTS = { url: '', username: '', password: '', pagesRoot: '/', sshTunnel: { ...SSH_TUNNEL_DEFAULTS } };
const GENERAL_DEFAULTS = { stripFrontMatter: true, remoteProvider: 'webdav' };
const RSS_DEFAULTS = {
  feeds: [],
  refreshIntervalMinutes: 30,
  backgroundRefresh: true,
  outputDir: '/rss',
  syncEnabled: true,
};
const DIFF_VIEWER_DEFAULTS = {
  tabBindings: {},          // { [tabLabel]: { scope, sessionId, path } }
  recentSshHosts: [],       // ordered list of user@host strings
  lastScope: 'local',       // picker default scope
  windowBounds: null,       // { x, y, width, height }
  alwaysOnTop: false,
  lastBinding: null,        // { scope, sessionId, path, cwd } — remembered across popup sessions
};
const PLAN_VIEWER_DEFAULTS = {
  lastPlanPath: null,
  windowBounds: null,
  alwaysOnTop: false,
};
const RSS_FETCH_TIMEOUT_MS = 20000;
const WEBDAV_REQUEST_TIMEOUT_MS = 15000;
const LLM_DEFAULT_MAX_TOKENS = 128000;
const LEGACY_LLM_MAX_TOKEN_VALUES = new Set([1024, 2048, 131072]);

function normalizeRemotePath(remotePath, fallback = '/') {
  let value = String(remotePath || fallback || '/')
    .trim()
    .replace(/\\/g, '/');
  if (!value) value = fallback || '/';
  if (!value.startsWith('/')) value = `/${value}`;
  value = path.posix.normalize(value);
  if (!value.startsWith('/')) value = `/${value}`;
  return value === '/' ? '/' : value.replace(/\/+$/, '');
}

function joinRemotePath(...parts) {
  return normalizeRemotePath(path.posix.join(...parts));
}

function getMindmapDefaults(webdav = WEBDAV_DEFAULTS) {
  const scanRoot = normalizeRemotePath(webdav.pagesRoot || '/');
  const outputDir = joinRemotePath(scanRoot, 'mindmap');
  return {
    scanRoot,
    outputDir,
    stateFilePath: joinRemotePath(outputDir, 'mindmap-state.json'),
    maxFileBytes: 25 * 1024 * 1024,
    parallelInference: 6,
    maxContextChars: 120000,
    restructureThreshold: 0.35,
  };
}

function normalizeMindmapSettings(mindmap, webdav) {
  const defaults = getMindmapDefaults(webdav);
  const merged = { ...defaults, ...(mindmap || {}) };
  merged.scanRoot = normalizeRemotePath(merged.scanRoot || defaults.scanRoot, defaults.scanRoot);
  merged.outputDir = normalizeRemotePath(merged.outputDir || defaults.outputDir, defaults.outputDir);
  merged.stateFilePath = normalizeRemotePath(
    merged.stateFilePath || joinRemotePath(merged.outputDir, 'mindmap-state.json'),
    defaults.stateFilePath
  );

  const maxFileBytes = Number(merged.maxFileBytes);
  const parallelInference = Number(merged.parallelInference);
  const maxContextChars = Number(merged.maxContextChars);
  const restructureThreshold = Number(merged.restructureThreshold);

  merged.maxFileBytes = Number.isFinite(maxFileBytes) && maxFileBytes > 0 ? maxFileBytes : defaults.maxFileBytes;
  merged.parallelInference =
    Number.isFinite(parallelInference) && parallelInference > 0
      ? Math.max(1, Math.floor(parallelInference))
      : defaults.parallelInference;
  merged.maxContextChars =
    Number.isFinite(maxContextChars) && maxContextChars > 0
      ? Math.max(2000, Math.floor(maxContextChars))
      : defaults.maxContextChars;
  merged.restructureThreshold =
    Number.isFinite(restructureThreshold) && restructureThreshold >= 0 && restructureThreshold <= 1
      ? restructureThreshold
      : defaults.restructureThreshold;
  return merged;
}

function normalizeLLMSettings(llm) {
  const merged = { ...(llm || {}) };
  const maxTokens = Number(merged.maxTokens);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0 || LEGACY_LLM_MAX_TOKEN_VALUES.has(maxTokens)) {
    merged.maxTokens = LLM_DEFAULT_MAX_TOKENS;
  } else {
    merged.maxTokens = Math.min(LLM_DEFAULT_MAX_TOKENS, Math.max(1, Math.floor(maxTokens)));
  }
  if (Object.prototype.hasOwnProperty.call(merged, 'systemPrompt')) {
    delete merged.systemPrompt;
  }
  return merged;
}

function loadSettings() {
  const defaults = {
    general: { ...GENERAL_DEFAULTS },
    llm: { maxTokens: LLM_DEFAULT_MAX_TOKENS },
    cloud: { ...CLOUD_DEFAULTS },
    cloudAgents: { ...CLOUD_AGENTS_DEFAULTS },
    webdav: { ...WEBDAV_DEFAULTS },
    agents: { mindmap: { params: getMindmapDefaults(WEBDAV_DEFAULTS) } },
    rss: { ...RSS_DEFAULTS, feeds: [] },
    diffViewer: { ...DIFF_VIEWER_DEFAULTS, tabBindings: {}, recentSshHosts: [] },
    planViewer: { ...PLAN_VIEWER_DEFAULTS },
  };
  try {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf-8'));
    const original = JSON.stringify(saved);
    saved.general = { ...GENERAL_DEFAULTS, ...(saved.general || {}) };
    saved.llm = normalizeLLMSettings(saved.llm);
    saved.cloud = { ...CLOUD_DEFAULTS, ...(saved.cloud || {}) };
    saved.cloudAgents = { ...CLOUD_AGENTS_DEFAULTS, ...(saved.cloudAgents || {}) };
    saved.webdav = { ...WEBDAV_DEFAULTS, ...(saved.webdav || {}) };
    saved.webdav.sshTunnel = { ...SSH_TUNNEL_DEFAULTS, ...(saved.webdav.sshTunnel || {}) };
    // Migrate legacy top-level `mindmap` → `agents.mindmap.params`, then drop.
    const rawMindmap = saved.agents?.mindmap?.params || saved.mindmap;
    delete saved.mindmap;
    saved.agents = {
      ...(saved.agents || {}),
      mindmap: {
        ...(saved.agents?.mindmap || {}),
        params: normalizeMindmapSettings(rawMindmap, saved.webdav),
      },
    };
    saved.rss = {
      ...RSS_DEFAULTS,
      ...(saved.rss || {}),
      feeds: Array.isArray(saved.rss?.feeds) ? saved.rss.feeds : [],
    };
    saved.diffViewer = {
      ...DIFF_VIEWER_DEFAULTS,
      ...(saved.diffViewer || {}),
      tabBindings: (saved.diffViewer && typeof saved.diffViewer.tabBindings === 'object' && saved.diffViewer.tabBindings) || {},
      recentSshHosts: Array.isArray(saved.diffViewer?.recentSshHosts) ? saved.diffViewer.recentSshHosts : [],
    };
    saved.planViewer = { ...PLAN_VIEWER_DEFAULTS, ...(saved.planViewer || {}) };
    if (JSON.stringify(saved) !== original) {
      saveSettings(saved);
    }
    // Transient mirror for legacy readers (mindmap worker, app.js view-existing).
    // Recreated on every load; never persisted (saveSettings runs before this).
    saved.mindmap = saved.agents.mindmap.params;
    return saved;
  } catch (_) {
    defaults.mindmap = defaults.agents.mindmap.params;
    return defaults;
  }
}

// ── Cloud crypto helpers ────────────────────────────────────────────────────

function deriveKek(password, userId, saltB64) {
  const salt = Buffer.concat([Buffer.from(userId), Buffer.from(saltB64, 'base64')]);
  return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');
}

function decryptFek(encryptedFekB64, ivB64, kek) {
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(encryptedFekB64, 'base64');
  const tag = ct.slice(-16);
  const dec = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct.slice(0, -16)), dec.final()]);
}

function encryptWithFek(plaintext, fek) {
  const iv = crypto.randomBytes(12);
  const enc = crypto.createCipheriv('aes-256-gcm', fek, iv);
  const ct = Buffer.concat([enc.update(plaintext, 'utf8'), enc.final()]);
  return {
    iv: iv.toString('base64'),
    content: Buffer.concat([ct, enc.getAuthTag()]).toString('base64'),
  };
}

function decryptWithFek(contentB64, ivB64, fek) {
  const iv = Buffer.from(ivB64, 'base64');
  const buf = Buffer.from(contentB64, 'base64');
  const tag = buf.slice(-16);
  const dec = crypto.createDecipheriv('aes-256-gcm', fek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(buf.slice(0, -16)), dec.final()]).toString('utf8');
}

// ── Tracker helpers ─────────────────────────────────────────────────────────

function initTracker() {
  ['local', 'webdav', 'cloud'].forEach((sub) =>
    fs.mkdirSync(path.join(TRACKER_DIR(), sub), { recursive: true })
  );
  if (!fs.existsSync(TRACKER_INDEX())) saveRegistry([]);
}

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_INDEX(), 'utf-8'));
  } catch (_) {
    return [];
  }
}

function saveRegistry(entries) {
  fs.writeFileSync(TRACKER_INDEX(), JSON.stringify(entries, null, 2), 'utf-8');
}

function makeSlug(originalPath, fileName) {
  const base = path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  const hash = crypto.createHash('sha256').update(originalPath).digest('hex').slice(0, 6);
  return `${base}-${hash}`;
}

function extractMeta(content, fileName) {
  const { data: fm, content: body } = parseFrontMatter(content);
  const hm = body.match(/^#{1,2}\s+(.+)$/m);
  const title =
    fm.title ||
    (hm ? hm[1].trim() : path.basename(fileName, path.extname(fileName)).replace(/[-_]/g, ' '));
  const excerptLine = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('```'));
  const excerpt = excerptLine ? excerptLine.replace(/[*_`[\]]/g, '').slice(0, 200) : '';
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  let tags = fm.tags || [];
  if (typeof tags === 'string') tags = [tags];
  return { title, excerpt, wordCount, tags, frontMatter: fm };
}

async function trackFile(source, originalPath, fileName, content, extra = {}) {
  try {
    const registry = loadRegistry();
    const now = new Date().toISOString();
    const slug = makeSlug(originalPath, fileName);
    let trackerRelPath;
    if (source === 'webdav') {
      const host = (extra.host || 'unknown').replace(/[^a-zA-Z0-9@._-]/g, '_');
      trackerRelPath = `webdav/${host}/${slug}.md`;
    } else if (source === 'cloud') {
      trackerRelPath = `cloud/${slug}.md`;
    } else {
      trackerRelPath = `local/${slug}.md`;
    }

    // Create symlink (local) or write snapshot (remote)
    const absTrackerPath = path.join(TRACKER_DIR(), trackerRelPath);
    fs.mkdirSync(path.dirname(absTrackerPath), { recursive: true });
    if (source === 'local') {
      if (!fs.existsSync(absTrackerPath)) {
        try {
          fs.symlinkSync(originalPath, absTrackerPath);
        } catch (_) {}
      }
    } else {
      fs.writeFileSync(absTrackerPath, content, 'utf-8');
    }

    const meta = extractMeta(content, fileName);
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    const idx = registry.findIndex((e) => e.originalPath === originalPath);
    if (idx >= 0) {
      const e = registry[idx];
      e.lastSeen = now;
      e.openCount = (e.openCount || 0) + 1;
      e.sizeBytes = sizeBytes;
      Object.assign(e, meta);
    } else {
      const { randomUUID } = crypto;
      registry.push({
        id: randomUUID(),
        slug,
        source,
        trackerRelPath,
        originalPath,
        fileName,
        webdavHost: extra.host || null,
        cloudKey: extra.cloudKey || null,
        ...meta,
        firstSeen: now,
        lastSeen: now,
        openCount: 1,
        sizeBytes,
      });
    }
    saveRegistry(registry);
  } catch (_) {
    // Never throw — tracking is always fire-and-forget
  }
}

async function maybeRefreshToken(settings) {
  const cloud = settings.cloud || {};
  if (!cloud.refreshToken || !cloud.tokenExpiresAt) return;
  if (Date.now() < new Date(cloud.tokenExpiresAt).getTime() - 5 * 60 * 1000) return;
  const base = (cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return;
  try {
    const resp = await fetch(`${base}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: cloud.refreshToken }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    cloud.accessToken = data.access_token;
    cloud.refreshToken = data.refresh_token;
    cloud.tokenExpiresAt = data.expires_at;
    saveSettings(settings);
  } catch (_) {}
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Pages mode helpers ──────────────────────────────────────────────────────

function parseSimpleYaml(raw) {
  const data = {};
  for (const line of (raw || '').split('\n')) {
    const m = line.match(/^([\w][\w-]*):\s*(.*)$/);
    if (m) data[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return data;
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  return { data: parseSimpleYaml(match[1]), content: match[2] };
}

function normalizePagePath(pagePath) {
  let p = (pagePath || 'index')
    .replace(/^\//, '')
    .replace(/\.html$/, '')
    .replace(/\.md$/, '');
  // Collapse any ../ that would escape root
  const parts = p.split('/').reduce((acc, seg) => {
    if (seg === '..') acc.pop();
    else if (seg && seg !== '.') acc.push(seg);
    return acc;
  }, []);
  return parts.join('/') || 'index';
}

// ── SSH Tunnel Manager ─────────────────────────────────────────────────────

let _activeTunnel = null; // { ssh, server, localPort, targetHost, targetPort }

function closeSshTunnel() {
  if (!_activeTunnel) return;
  try { _activeTunnel.server.close(); } catch (_) { /* ignore */ }
  try { _activeTunnel.ssh.end(); } catch (_) { /* ignore */ }
  _activeTunnel = null;
}

function ensureSshTunnel(settings) {
  const tunnel = settings.webdav?.sshTunnel;
  if (!tunnel?.enabled || !tunnel.host) {
    return Promise.reject(new Error('SSH tunnel is enabled but SSH host is not configured.'));
  }

  const parsed = new URL(settings.webdav.url);
  const targetHost = parsed.hostname;
  const targetPort = Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80);

  // Reuse if the tunnel is alive and targeting the same endpoint
  if (
    _activeTunnel &&
    _activeTunnel.targetHost === targetHost &&
    _activeTunnel.targetPort === targetPort
  ) {
    return Promise.resolve(_activeTunnel.localPort);
  }

  closeSshTunnel();

  return new Promise((resolve, reject) => {
    const ssh = new SshClient();
    const connectOpts = {
      host: tunnel.host,
      port: Number(tunnel.port) || 22,
      username: tunnel.username || 'root',
    };

    // Read private key if provided
    if (tunnel.privateKeyPath) {
      try {
        const keyPath = tunnel.privateKeyPath.replace(/^~/, os.homedir());
        connectOpts.privateKey = fs.readFileSync(keyPath);
        if (tunnel.passphrase) connectOpts.passphrase = tunnel.passphrase;
      } catch (err) {
        return reject(new Error(`Cannot read SSH key: ${err.message}`));
      }
    }

    // Also try the ssh-agent if available
    if (process.env.SSH_AUTH_SOCK) {
      connectOpts.agent = process.env.SSH_AUTH_SOCK;
    }

    ssh.on('error', (err) => {
      closeSshTunnel();
      reject(new Error(`SSH connection failed: ${err.message}`));
    });

    ssh.on('ready', () => {
      // Create a local TCP server that forwards each connection through SSH
      const server = net.createServer((sock) => {
        ssh.forwardOut('127.0.0.1', sock.localPort, targetHost, targetPort, (err, stream) => {
          if (err) { sock.destroy(); return; }
          sock.pipe(stream).pipe(sock);
          stream.on('error', () => sock.destroy());
          sock.on('error', () => stream.destroy());
        });
      });

      server.listen(0, '127.0.0.1', () => {
        const localPort = server.address().port;
        _activeTunnel = { ssh, server, localPort, targetHost, targetPort };
        resolve(localPort);
      });

      server.on('error', (err) => {
        closeSshTunnel();
        reject(new Error(`SSH tunnel local server failed: ${err.message}`));
      });
    });

    ssh.connect(connectOpts);
  });
}

// ── Terminal (local PTY) ────────────────────────────────────────────────────

let pty;
try {
  pty = require('node-pty');
} catch (_) {
  pty = null;
}
const _ptyProcesses = new Map();

function killTerminalPty(ptyId) {
  if (ptyId) {
    const proc = _ptyProcesses.get(ptyId);
    if (proc) {
      try { proc.kill(); } catch (_) { /* ignore */ }
      try { proc.destroy(); } catch (_) { /* ignore */ }
      _ptyProcesses.delete(ptyId);
    }
    try { _planReleaseTab && _planReleaseTab(ptyId); } catch (_) {}
  } else {
    for (const [id, proc] of _ptyProcesses) {
      try { proc.kill(); } catch (_) { /* ignore */ }
      try { proc.destroy(); } catch (_) { /* ignore */ }
    }
    _ptyProcesses.clear();
  }
}

// ── WebDAV helpers ──────────────────────────────────────────────────────────

async function getWebdavClient(settings) {
  const { url, username, password } = settings.webdav || {};
  if (!url) throw new Error('WebDAV URL not configured. Open Settings → General to configure.');

  let effectiveUrl = url;
  const tunnel = settings.webdav?.sshTunnel;
  if (tunnel?.enabled) {
    const localPort = await ensureSshTunnel(settings);
    const parsed = new URL(url);
    effectiveUrl = `${parsed.protocol}//localhost:${localPort}${parsed.pathname}${parsed.search}`;
  }

  return createWebdavClient(effectiveUrl, username ? { username, password: password || '' } : {});
}

// Handle WebDAV save requests from the worker process.
// The worker sends { type: 'webdav:save', reqId, filePath, dirPath, content }
// and we reply with { type: 'webdav:save:reply', reqId, success, filePath?, error? }.
// This runs in the main process so the SSH tunnel is re-established if needed.
async function handleWorkerWebdavSave(msg) {
  const { reqId, filePath, dirPath, content } = msg;
  try {
    const settings = loadSettings();
    const client = await getWebdavClient(settings);
    if (dirPath && dirPath !== '/') {
      const normalizedDir = dirPath.endsWith('/') ? dirPath : dirPath + '/';
      await client.createDirectory(normalizedDir, { recursive: true });
    }
    await client.putFileContents(filePath, content, { overwrite: true });
    _worker?.send({ type: 'webdav:save:reply', reqId, success: true, filePath });
  } catch (err) {
    _worker?.send({ type: 'webdav:save:reply', reqId, success: false, error: err.message || String(err) });
  }
}

// Handle WebDAV read requests from the worker process.
// The worker sends { type: 'webdav:read', reqId, filePath }
// and we reply with { type: 'webdav:read:reply', reqId, success, content?, error? }.
async function handleWorkerWebdavRead(msg) {
  const { reqId, filePath } = msg;
  try {
    const settings = loadSettings();
    const client = await getWebdavClient(settings);
    const content = await client.getFileContents(filePath, { format: 'text' });
    _worker?.send({ type: 'webdav:read:reply', reqId, success: true, content: String(content) });
  } catch (err) {
    _worker?.send({ type: 'webdav:read:reply', reqId, success: false, error: err.message || String(err) });
  }
}

function withTimeout(promise, ms, timeoutMessage) {
  let timer = null;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage || 'Operation timed out.'));
    }, ms);

    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  });
}

function extractFileArg(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    const ext = path.extname(arg).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      const resolved = path.resolve(arg);
      try {
        fs.accessSync(resolved, fs.constants.R_OK);
        return resolved;
      } catch (_) {
        /* not readable, skip */
      }
    }
  }
  return null;
}

async function sendFileToRenderer(filePath) {
  if (!mainWindow) return;
  try {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    if (fileSize > LARGE_FILE_MAX_BYTES) {
      mainWindow.webContents.send('file:opened', { filePath, fileSize, tooLarge: true });
      return;
    }

    if (ext === '.pdf') {
      const buffer = await fs.promises.readFile(filePath);
      const content = buffer.toString('base64');
      mainWindow.webContents.send('file:opened', { filePath, content, fileType: 'pdf', fileSize });
    } else if (fileSize > LARGE_FILE_WARN_BYTES) {
      mainWindow.webContents.send('file:opened', { filePath, fileSize, needsConfirmation: true });
    } else {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      trackFile('local', filePath, path.basename(filePath), content).catch(() => {});
      mainWindow.webContents.send('file:opened', { filePath, content, fileSize });
    }
  } catch (_) {
    /* unreadable, ignore */
  }
}

const {
  killAppImageWrapper,
  shouldRegisterWrapperKill,
  focusExistingWindow,
  createRelaunchHandler,
} = require('./process-lifecycle');

// Snapshot the AppImage wrapper identity at process start, before any
// reparenting can happen. Used at will-quit to refuse SIGTERM if runtime
// identity has drifted from startup (e.g. original parent died and we got
// adopted by systemd). If /proc is unavailable the snapshot is null — the
// in-function checks still default-deny.
const _wrapperSnapshot = (() => {
  try {
    const fs = require('fs');
    const ppid = process.ppid;
    if (!ppid) return null;
    const comm = fs.readFileSync(`/proc/${ppid}/comm`, 'utf8').replace(/\n$/, '');
    let exe = null;
    try { exe = fs.readlinkSync(`/proc/${ppid}/exe`); } catch (_) { /* ignore */ }
    return { ppid, comm, exe };
  } catch (_) {
    return null;
  }
})();

function _logWrapperKill(entry) {
  try { console.log('[wrapper-kill]', JSON.stringify(entry)); } catch (_) {}
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  if (shouldRegisterWrapperKill()) {
    killAppImageWrapper({ snapshot: _wrapperSnapshot, log: _logWrapperKill });
  }
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractFileArg(argv);
    if (filePath && mainWindow) {
      sendFileToRenderer(filePath);
    }
    focusExistingWindow(mainWindow);
  });
}

// macOS: "Open With" / double-click file delivers path via open-file, not argv.
// Register in will-finish-launching so we don't miss the event (it can fire before ready).
function handleOpenFile(event, filePath) {
  event.preventDefault();
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) return;
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (_) {
    return;
  }
  if (mainWindow) {
    sendFileToRenderer(filePath);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingFilePath = filePath;
  }
}

if (process.platform === 'darwin') {
  app.on('will-finish-launching', () => {
    app.on('open-file', handleOpenFile);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Route window.open() and external links to the user's default browser instead
  // of opening a blank Electron BrowserWindow.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current && /^https?:/i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:openFile'),
        },
        {
          label: 'Open Remote…',
          click: () => mainWindow.webContents.send('menu:openRemote'),
        },
        {
          label: 'Save File',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:saveFile'),
        },
        {
          label: 'Save Remote',
          click: () => mainWindow.webContents.send('menu:saveRemote'),
        },
        { type: 'separator' },
        {
          label: 'Relaunch',
          click: createRelaunchHandler({
            app,
            spawn: require('child_process').spawn,
            appImagePath: process.env.APPIMAGE,
            args: process.argv.slice(1),
            execPath: process.execPath,
            candidatePaths: [
              path.join(os.homedir(), '.local', 'bin', 'MarkAllDown.AppImage'),
              '/usr/local/share/MarkAllDown/MarkAllDown.AppImage',
            ],
            fileExists: (p) => {
              try {
                fs.accessSync(p, fs.constants.X_OK);
                return true;
              } catch (_) {
                return false;
              }
            },
            log: (entry) => {
              try {
                const dir = path.join(os.homedir(), '.cache', 'markalldown');
                fs.mkdirSync(dir, { recursive: true });
                const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
                fs.appendFileSync(path.join(dir, 'relaunch.log'), line);
              } catch (_) {
                /* best-effort diagnostic only */
              }
            },
            errorDialog: (title, body) => {
              try {
                dialog.showErrorBox(title, body);
              } catch (_) {}
            },
          }),
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu:find'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Claude Diff Viewer',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            // Ask the main-window renderer to open — it injects the active
            // terminal tab's ptyId so the popup picks up remote SSH context.
            try {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu:openDiffWindow');
              } else { _diffOpenWindow(); }
            } catch (e) { console.warn('[diff] open failed', e); }
          },
        },
        {
          label: 'Claude Plan Viewer',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            try {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu:openPlanWindow');
              } else { _planOpenWindow(); }
            } catch (e) { console.warn('[plan] open failed', e); }
          },
        },
        {
          label: 'Cycle Windows',
          accelerator: 'CmdOrCtrl+`',
          click: () => _cycleWindowFocus(),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    const filePath = pendingFilePath || extractFileArg(process.argv);
    pendingFilePath = null;
    if (filePath) {
      sendFileToRenderer(filePath);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    try { diffWindowModule.closeDiffWindow(); } catch {}
    try { planWindowModule.closePlanWindow(); } catch {}
  });
}

ipcMain.handle('dialog:openFile', async (_event, options = {}) => {
  const allowMultiple = options.allowMultiple !== false;
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [
      {
        name: 'All Supported',
        extensions: [
          'md', 'markdown', 'txt', 'pdf',
          'json', 'yaml', 'yml', 'xml', 'csv', 'log',
          'ini', 'toml', 'conf', 'cfg', 'env', 'properties',
          'sh', 'bash', 'zsh', 'py', 'js', 'ts', 'html', 'css',
        ],
      },
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Text / Code', extensions: ['txt', 'json', 'yaml', 'yml', 'xml', 'csv', 'log', 'ini', 'toml', 'conf', 'cfg', 'env', 'properties', 'sh', 'bash', 'zsh', 'py', 'js', 'ts', 'html', 'css'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || filePaths.length === 0) return null;
  const results = [];
  for (const fp of filePaths) {
    const ext = path.extname(fp).toLowerCase();
    const stats = await fs.promises.stat(fp);
    const fileSize = stats.size;

    if (fileSize > LARGE_FILE_MAX_BYTES) {
      results.push({ filePath: fp, fileSize, tooLarge: true });
    } else if (ext === '.pdf') {
      const buffer = await fs.promises.readFile(fp);
      results.push({ filePath: fp, content: buffer.toString('base64'), fileType: 'pdf', fileSize });
    } else if (fileSize > LARGE_FILE_WARN_BYTES) {
      results.push({ filePath: fp, fileSize, needsConfirmation: true });
    } else {
      const content = await fs.promises.readFile(fp, 'utf-8');
      results.push({ filePath: fp, content, fileSize });
      trackFile('local', fp, path.basename(fp), content).catch(() => {});
    }
  }
  return results;
});

ipcMain.handle('dialog:readPdfFile', async (_event, filePath) => {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.toString('base64');
});

ipcMain.handle('dialog:readFileConfirmed', async (_event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const buffer = await fs.promises.readFile(filePath);
    return { filePath, content: buffer.toString('base64'), fileType: 'pdf' };
  }
  const content = await fs.promises.readFile(filePath, 'utf-8');
  trackFile('local', filePath, path.basename(filePath), content).catch(() => {});
  return { filePath, content };
});

ipcMain.handle('dialog:saveFile', async (_event, { defaultPath, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultPath || 'untitled.md',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return null;
  await fs.promises.writeFile(filePath, content, 'utf-8');
  trackFile('local', filePath, path.basename(filePath), content).catch(() => {});
  return filePath;
});

ipcMain.handle('dialog:saveHtml', async (_event, { content, defaultPath }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultPath || 'markdown-document.html',
    filters: [
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return null;
  await fs.promises.writeFile(filePath, content, 'utf-8');
  return filePath;
});

// ── Settings IPC ──

ipcMain.handle('dialog:openPrivateKey', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select SSH Private Key',
    defaultPath: path.join(os.homedir(), '.ssh'),
    properties: ['openFile', 'showHiddenFiles'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('shell:openExternal', async (_event, url) => {
  if (typeof url !== 'string') return false;
  if (!/^https?:/i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('settings:load', async () => {
  return loadSettings();
});

ipcMain.handle('settings:save', async (_event, settings) => {
  closeSshTunnel(); // close stale tunnel so next WebDAV call re-establishes with new settings
  saveSettings(settings);
  // Invalidate pages cache whenever settings change
  _pagesConfigCache = {};
  _pagesLayoutCache = {};
  _pagesIncludeCache = {};
  // Notify any open pop-up windows so they can re-apply font settings live.
  try {
    const popups = [];
    const dw = diffWindowModule.getDiffWindow && diffWindowModule.getDiffWindow();
    const pw = planWindowModule.getPlanWindow && planWindowModule.getPlanWindow();
    if (dw && !dw.isDestroyed()) popups.push(dw);
    if (pw && !pw.isDestroyed()) popups.push(pw);
    for (const w of popups) {
      try { w.webContents.send('settings:changed', settings); } catch (_) {}
    }
  } catch (_) {}
  return true;
});

// ── WebDAV IPC ──

ipcMain.handle('webdav:testConnection', async () => {
  const settings = loadSettings();
  try {
    const client = await getWebdavClient(settings);
    const t0 = Date.now();
    await withTimeout(
      client.stat('/'),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out connecting to the WebDAV server.'
    );
    return { success: true, latency: Date.now() - t0 };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('webdav:listFiles', async (_event, { path: dirPath = '/' } = {}) => {
  const settings = loadSettings();
  try {
    const client = await getWebdavClient(settings);
    const items = await withTimeout(
      client.getDirectoryContents(dirPath),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out loading this WebDAV folder.'
    );
    return {
      success: true,
      items: items
        .filter(webdavPagesListAcceptsItem)
        .map((i) => ({
          name: (i.filename && path.basename(i.filename)) || i.basename,
          path: i.filename,
          type: i.type,
          size: i.size,
        })),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err), items: [] };
  }
});

ipcMain.handle('webdav:stat', async (_event, { remotePath }) => {
  const settings = loadSettings();
  try {
    const client = await getWebdavClient(settings);
    const stat = await withTimeout(
      client.stat(remotePath),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out checking file.'
    );
    return {
      success: true,
      exists: true,
      type: stat.type,
      size: stat.size,
      lastmod: stat.lastmod || null,
      etag: stat.etag || null,
    };
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.includes('404'))) {
      return { success: true, exists: false };
    }
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('webdav:readFile', async (_event, { remotePath, skipTrack = false }) => {
  const settings = loadSettings();
  const fileName = path.basename(remotePath);
  const ext = path.extname(remotePath).toLowerCase();
  const url = new URL(settings.webdav.url);
  const originalPath = settings.webdav.url.replace(/\/$/, '') + remotePath;

  try {
    const client = await getWebdavClient(settings);
    const statPromise = withTimeout(
      client.stat(remotePath),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out checking file.'
    ).catch(() => null);

    const mimeType = WEBDAV_BINARY_IMAGE_EXT_TO_MIME[ext];
    if (mimeType) {
      const [buf, stat] = await Promise.all([
        withTimeout(
          client.getFileContents(remotePath, { format: 'binary' }),
          WEBDAV_REQUEST_TIMEOUT_MS,
          'Timed out loading this WebDAV file.'
        ),
        statPromise,
      ]);
      const content = Buffer.from(buf).toString('base64');
      return {
        success: true,
        encoding: 'base64',
        content,
        mimeType,
        filePath: remotePath,
        fileName,
        lastmod: stat?.lastmod || null,
        etag: stat?.etag || null,
      };
    }

    if (ext === '.pdf') {
      const [buf, stat] = await Promise.all([
        withTimeout(
          client.getFileContents(remotePath, { format: 'binary' }),
          WEBDAV_REQUEST_TIMEOUT_MS,
          'Timed out loading this WebDAV file.'
        ),
        statPromise,
      ]);
      const content = Buffer.from(buf).toString('base64');
      return {
        success: true,
        content,
        filePath: remotePath,
        fileName,
        fileType: 'pdf',
        lastmod: stat?.lastmod || null,
        etag: stat?.etag || null,
      };
    }

    const [content, stat] = await Promise.all([
      withTimeout(
        client.getFileContents(remotePath, { format: 'text' }),
        WEBDAV_REQUEST_TIMEOUT_MS,
        'Timed out loading this WebDAV file.'
      ),
      statPromise,
    ]);
    if (!skipTrack) {
      trackFile('webdav', originalPath, fileName, content, { host: url.hostname }).catch(() => {});
    }
    return {
      success: true,
      content,
      filePath: remotePath,
      fileName,
      lastmod: stat?.lastmod || null,
      etag: stat?.etag || null,
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('webdav:writeFile', async (_event, { remotePath, content }) => {
  const settings = loadSettings();
  try {
    const client = await getWebdavClient(settings);
    await withTimeout(
      client.putFileContents(remotePath, content, { overwrite: true }),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out saving to WebDAV.'
    );
    const fileName = path.basename(remotePath);
    const url = new URL(settings.webdav.url);
    const originalPath = settings.webdav.url.replace(/\/$/, '') + remotePath;
    trackFile('webdav', originalPath, fileName, content, { host: url.hostname }).catch(() => {});
    return { success: true, filePath: remotePath, fileName };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

// ── RSS IPC ──

ipcMain.handle('rss:fetchFeed', async (_event, { url } = {}) => {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'No URL provided' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'MarkAllDown-RSS/1.0',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const xmlText = await res.text();
    return { success: true, xmlText };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out' : (err.message || String(err));
    return { success: false, error: msg };
  }
});

ipcMain.handle('rss:saveState', async (_event, { stateJson } = {}) => {
  if (typeof stateJson !== 'string') {
    return { success: false, error: 'Invalid state' };
  }
  const settings = loadSettings();
  if (!settings.webdav?.url) {
    return { success: false, error: 'WebDAV not configured' };
  }
  const dir = normalizeRemotePath(settings.rss?.outputDir || '/rss');
  const remotePath = joinRemotePath(dir, 'state.json');
  try {
    const client = await getWebdavClient(settings);
    try {
      await client.createDirectory(dir, { recursive: true });
    } catch (_) {
      /* directory may already exist */
    }
    await withTimeout(
      client.putFileContents(remotePath, stateJson, { overwrite: true }),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out saving RSS state.'
    );
    return { success: true, remotePath };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('rss:loadState', async () => {
  const settings = loadSettings();
  if (!settings.webdav?.url) {
    return { success: false, error: 'WebDAV not configured' };
  }
  const dir = normalizeRemotePath(settings.rss?.outputDir || '/rss');
  const remotePath = joinRemotePath(dir, 'state.json');
  try {
    const client = await getWebdavClient(settings);
    const content = await withTimeout(
      client.getFileContents(remotePath, { format: 'text' }),
      WEBDAV_REQUEST_TIMEOUT_MS,
      'Timed out loading RSS state.'
    );
    return { success: true, stateJson: content };
  } catch (err) {
    const msg = err.message || String(err);
    const notFound = /404|not found|ENOENT/i.test(msg);
    return { success: false, error: msg, notFound };
  }
});

// ── Smart RSS IPC (semantic ranking + thumbs) ────────────────────────
const SMART_RSS_TYPES = new Set([
  'ping', 'embedArticles', 'listInterests', 'addInterest', 'removeInterest',
  'suggestInterestsFromOpml', 'score', 'react', 'getDislikeCentroid',
  'runNightlyPromote', 'fetchSource',
]);

ipcMain.handle('smart-rss:call', async (_event, { type, payload } = {}) => {
  if (!SMART_RSS_TYPES.has(type)) throw new Error(`unknown smart-rss type: ${type}`);
  return smartRssCall(type, payload);
});

ipcMain.handle('dialog:openOpmlFile', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import OPML',
    filters: [
      { name: 'OPML', extensions: ['opml', 'xml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) {
    return { success: false, canceled: true };
  }
  try {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

// ── LLM IPC ──

const LLM_DEFAULTS = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: LLM_DEFAULT_MAX_TOKENS,
  topP: 1.0,
};

function resolveLLMConfig(config = {}) {
  const settings = loadSettings();
  const merged = { ...LLM_DEFAULTS, ...(settings.llm || {}), ...(config || {}) };
  return {
    provider: merged.provider,
    baseUrl: merged.baseUrl,
    apiKey: merged.apiKey,
    model: merged.model,
    temperature: merged.temperature,
    maxTokens: merged.maxTokens,
    topP: merged.topP,
  };
}

function looksLikeAnthropicModel(model) {
  const value = String(model || '').toLowerCase();
  return value.includes('claude') || value.includes('anthropic/');
}

function buildSamplingParams({ provider, model, temperature, topP }) {
  const params = {};
  const useSingleSamplingControl = provider === 'anthropic' || looksLikeAnthropicModel(model);

  if (useSingleSamplingControl) {
    if (Number.isFinite(temperature)) {
      params.temperature = temperature;
    } else if (Number.isFinite(topP)) {
      params.top_p = topP;
    }
    return params;
  }

  if (Number.isFinite(temperature)) params.temperature = temperature;
  if (Number.isFinite(topP)) params.top_p = topP;
  return params;
}

function clampLLMMaxTokens(maxTokens) {
  const value = Number(maxTokens);
  if (!Number.isFinite(value) || value <= 0) return LLM_DEFAULT_MAX_TOKENS;
  return Math.min(LLM_DEFAULT_MAX_TOKENS, Math.max(1, Math.floor(value)));
}

async function performLLMCall(llm, messages, overrides = {}) {
  const temperature = overrides.temperature ?? llm.temperature;
  const maxTokens = clampLLMMaxTokens(overrides.maxTokens ?? llm.maxTokens);
  const topP = overrides.topP ?? llm.topP;
  const systemPrompt = typeof overrides.systemPrompt === 'string' ? overrides.systemPrompt : '';

  if (llm.provider === 'anthropic') {
    const base = (llm.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const isOfficialAnthropic = /^https?:\/\/api\.anthropic\.com(?:\/|$)/i.test(base);
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (llm.apiKey) {
      headers[isOfficialAnthropic ? 'x-api-key' : 'Authorization'] = isOfficialAnthropic
        ? llm.apiKey
        : `Bearer ${llm.apiKey}`;
      if (!isOfficialAnthropic) headers['x-api-key'] = llm.apiKey;
    }
    const resp = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: llm.model || 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        ...buildSamplingParams({ provider: llm.provider, model: llm.model, temperature, topP }),
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages.filter((m) => m.role !== 'system'),
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message || `HTTP ${resp.status}` };
    }
    return { success: true, content: data.content[0]?.text ?? '' };
  } else {
    // OpenAI-compatible (OpenAI, vLLM, llama.cpp, Ollama, …)
    const base = (llm.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (llm.apiKey) headers['Authorization'] = `Bearer ${llm.apiKey}`;

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    const body = {
      messages: allMessages,
      max_tokens: maxTokens,
      ...buildSamplingParams({ provider: llm.provider, model: llm.model, temperature, topP }),
    };
    if (llm.model) body.model = llm.model;

    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message || `HTTP ${resp.status}` };
    }
    return { success: true, content: data.choices[0]?.message?.content ?? '' };
  }
}

ipcMain.handle('llm:call', async (_event, { messages, overrides = {}, config = {} } = {}) => {
  const llm = resolveLLMConfig(config);
  try {
    return await performLLMCall(llm, messages || [], overrides);
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('llm:test', async (_event, { config = {} } = {}) => {
  const llm = resolveLLMConfig(config);
  const startedAt = Date.now();

  try {
    const result = await performLLMCall(
      llm,
      [{ role: 'user', content: 'Reply with a very short confirmation that the model connection works.' }],
      { temperature: 0, maxTokens: 32 }
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Connection failed' };
    }

    return {
      success: true,
      latencyMs: Date.now() - startedAt,
      preview: String(result.content || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('llm:fetchModels', async (_event, { config = {} } = {}) => {
  const llm = resolveLLMConfig(config);

  if (llm.provider === 'anthropic') {
    return {
      success: false,
      error: 'Anthropic does not expose a model listing endpoint',
      models: [],
    };
  }

  const base = (llm.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = {};
  if (llm.apiKey) headers['Authorization'] = `Bearer ${llm.apiKey}`;

  try {
    const resp = await fetch(`${base}/models`, { headers });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message || `HTTP ${resp.status}`, models: [] };
    }
    const models = (data.data || []).map((m) => m.id).sort();
    return { success: true, models };
  } catch (err) {
    return { success: false, error: err.message || String(err), models: [] };
  }
});

// ── Agents ──

const agentManager = new AgentManager();

// Auto-discover agents by scanning agents/*/AGENT.md. Any folder whose name
// doesn't start with "_" (framework) or "." (hidden) and contains an AGENT.md
// becomes a registered agent. Skipped folders (e.g. _runtime/, _cloud/) are
// framework, not agents.
const _agentsDir = path.join(__dirname, 'agents');

function registerAgentFromScan(entry) {
  agentManager.register({
    id: entry.manifest.name,
    title: entry.manifest.title || entry.manifest.name,
    description: entry.manifest.description || '',
    manifest: entry.manifest,
    dir: entry.dir,
  });
}

for (const entry of scanAgents(_agentsDir)) registerAgentFromScan(entry);

// Explicit reload only — users click "Reload Agents" in Settings → Agents when
// they've added/edited/removed an agent folder on disk. No fs watcher runs.
ipcMain.handle('agent:reload', async () => {
  try {
    agentManager.clear();
    const entries = scanAgents(_agentsDir);
    for (const e of entries) registerAgentFromScan(e);
    spawnWorker();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:list:changed');
    }
    return { success: true, count: entries.length };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

function validateAgentSettings(agentId, settings) {
  const manifest = agentManager.getManifest(agentId);
  const requires = manifest?.requires || {};

  if (requires.webdav && !settings?.webdav?.url) {
    return {
      success: false,
      error: 'WebDAV is not configured. Open Settings → General to add a server URL.',
      unconfigured: 'webdav',
    };
  }

  if (requires.llm && !settings?.llm?.model) {
    return {
      success: false,
      error: 'LLM model is not configured. Open Settings → LLM to choose a model.',
      unconfigured: 'llm',
    };
  }

  const providerRequired = requires.llm?.provider;
  if (providerRequired && settings?.llm?.provider !== providerRequired) {
    return {
      success: false,
      error: `${manifest.title || agentId} requires an ${providerRequired}-compatible model.`,
      unconfigured: 'llm',
    };
  }

  return null;
}

ipcMain.handle('agent:list', async () => {
  return agentManager.listAgents();
});

ipcMain.handle('agent:run', async (_event, { agentId, params = {} }) => {
  if (typeof params.instructions !== 'string') params.instructions = '';
  if (!agentManager.getDescriptor(agentId))
    return { success: false, error: `Unknown agent: ${agentId}` };
  if (agentManager.status(agentId).status === 'running')
    return { success: false, error: `Agent "${agentId}" is already running` };
  if (!_worker || !_workerReady)
    return { success: false, error: 'Agent worker not ready — please retry in a moment.' };

  const settings = loadSettings();
  // Merge per-agent LLM overrides over the global LLM. Blank/undefined fields
  // inherit; any present value wins. Worker still sees a flat `settings.llm`.
  const agentOverride = settings.agents?.[agentId]?.llm || {};
  const mergedLlm = { ...(settings.llm || {}) };
  for (const k of ['provider', 'baseUrl', 'apiKey', 'model', 'temperature', 'maxTokens', 'topP']) {
    const v = agentOverride[k];
    if (v !== undefined && v !== null && v !== '') mergedLlm[k] = v;
  }
  settings.llm = mergedLlm;
  const validationError = validateAgentSettings(agentId, settings);
  if (validationError) return validationError;

  // Resolve tunneled URL so the worker (child process) can connect directly.
  // Only agents that declare a WebDAV capability get the rewrite; agents
  // without it are left alone.
  const manifest = agentManager.getManifest(agentId);
  const webdavCap = manifest?.capabilities?.webdav;
  if (webdavCap && settings.webdav?.url) {
    const tunnel = settings.webdav?.sshTunnel;
    if (tunnel?.enabled) {
      try {
        const localPort = await ensureSshTunnel(settings);
        const parsed = new URL(settings.webdav.url);
        settings.webdav = {
          ...settings.webdav,
          url: `${parsed.protocol}//localhost:${localPort}${parsed.pathname}${parsed.search}`,
        };
      } catch (err) {
        return { success: false, error: `SSH tunnel failed: ${err.message}` };
      }
    }
  }

  const runId = `${agentId}-${Date.now()}`;
  agentManager.markRunning(agentId, runId);

  const workerPromise = new Promise((resolve) => _pendingRuns.set(runId, { agentId, resolve }));
  // Merge per-agent param defaults (from settings.agents[id].params) under the
  // run-time params; UI-provided values win.
  const agentParamDefaults = settings.agents?.[agentId]?.params || {};
  _worker.send({
    type: 'run',
    runId,
    agentId,
    params: { ...agentParamDefaults, ...params, settings },
  });

  workerPromise.then((msg) => {
    agentManager.markFinished(agentId, msg.type === 'done' ? 'done' : 'error', msg.message);
  });

  return { success: true, started: true };
});

ipcMain.handle('agent:cancel', async (_event, { agentId }) => {
  const run = agentManager.getRunState(agentId);
  if (run?.status === 'running' && run.runId) {
    agentManager.markCancelling(agentId);
    if (_worker) _worker.send({ type: 'cancel', runId: run.runId });
  }
  return { success: true };
});

ipcMain.handle('agent:message', async (_event, { agentId, text, action }) => {
  const run = agentManager.getRunState(agentId);
  if (run?.status === 'running' && run.runId && _worker) {
    _worker.send({ type: 'message', runId: run.runId, data: { text, action } });
  }
  return { success: true };
});

ipcMain.handle('agent:status', async (_event, { agentId }) => {
  return agentManager.status(agentId);
});

// ── Cloud Agents IPC ────────────────────────────────────────────────────────
//
// Parallel execution path that forwards agent runs to the Python cloud-agents
// service (SSE). Emits events on the SAME `agent:progress` channel the local
// worker uses, so the renderer stays execution-mode agnostic. Active sessions
// are tracked here by agentId so cancel/message calls can route correctly.

// Keyed by instanceId (renderer-supplied; falls back to agentId so agents
// that don't care about concurrent sessions keep their single-session
// semantics without any renderer changes).
const _cloudSessions = new Map();

function forwardCloudEvent(instanceId, evt) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:progress', { ...evt, instanceId });
  }
}

ipcMain.handle('cloud-agent:run', async (_event, { agentId, instanceId, params = {} }) => {
  if (!agentId) return { success: false, error: 'cloud-agent: agentId is required' };
  const key = instanceId || agentId;
  if (_cloudSessions.has(key)) {
    return { success: false, error: `cloud-agent "${key}" is already running` };
  }

  const settings = loadSettings();
  // Per-agent `server` override (from the agent's own settings subpanel) beats
  // the global `cloudAgents` block. Blank = inherit global.
  const perAgentServer = settings?.agents?.[agentId]?.server || {};
  const baseUrl =
    perAgentServer?.baseUrl?.trim() ||
    settings?.cloudAgents?.baseUrl?.trim() ||
    settings?.cloudAgents?.apiBaseUrl?.trim() ||
    '';
  if (!baseUrl) {
    return {
      success: false,
      error: 'Cloud agents service URL is not configured. Open Settings → Cloud Agents.',
      unconfigured: 'cloudAgents',
    };
  }
  const jwt =
    perAgentServer?.token?.trim() ||
    settings?.cloudAgents?.token?.trim() ||
    settings?.cloud?.accessToken ||
    '';

  const manifest = agentManager.getManifest(agentId);
  if (!manifest?.cloud?.run) {
    return {
      success: false,
      error: `Agent "${agentId}" has no cloud.run route in its AGENT.md manifest.`,
    };
  }

  const session = new CloudAgentSession({
    baseUrl,
    jwt,
    agentId,
    manifest,
    onEvent: (evt) => {
      forwardCloudEvent(key, evt);
      if (evt.type === 'done' || evt.type === 'error') {
        _cloudSessions.delete(key);
      }
    },
  });
  _cloudSessions.set(key, session);

  // Fire-and-forget; progress/done/error flow through onEvent.
  (async () => {
    try {
      await session.run(params);
    } catch (err) {
      forwardCloudEvent(key, { type: 'error', agentId, message: err.message || String(err) });
      _cloudSessions.delete(key);
    }
  })();

  return { success: true, started: true, instanceId: key };
});

ipcMain.handle('cloud-agent:cancel', async (_event, { agentId, instanceId }) => {
  const key = instanceId || agentId;
  const session = _cloudSessions.get(key);
  if (!session) return { success: true };
  try {
    await session.cancel();
  } catch (_) {}
  return { success: true };
});

ipcMain.handle('cloud-agent:message', async (_event, { agentId, instanceId, text, action }) => {
  const key = instanceId || agentId;
  const session = _cloudSessions.get(key);
  if (!session) return { success: false, error: `No active cloud session for "${key}"` };
  await session.sendMessage({ text, action });
  return { success: true };
});

// ── Terminal (local PTY) IPC ────────────────────────────────────────────────

ipcMain.handle('terminal:spawn', async () => {
  if (!pty) {
    return { success: false, error: 'Terminal not available: native pty module not installed for this platform.' };
  }
  const ptyId = crypto.randomUUID();
  const shell = process.platform === 'win32'
    ? 'powershell.exe'
    : (process.env.SHELL || '/bin/bash');
  const args = process.platform === 'win32' ? [] : ['--login'];

  try {
    const ptyProc = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: { ...process.env, COLORTERM: 'truecolor' },
    });

    _ptyProcesses.set(ptyId, ptyProc);

    ptyProc.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:output', { ptyId, data });
      }
    });

    ptyProc.onExit(({ exitCode }) => {
      _ptyProcesses.delete(ptyId);
      try { ptyProc.destroy(); } catch (_) { /* already destroyed */ }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', { ptyId, exitCode });
      }
    });

    return { success: true, ptyId };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('terminal:kill', async (_event, { ptyId }) => {
  killTerminalPty(ptyId);
  return { success: true };
});

ipcMain.on('terminal:input', (_event, { ptyId, data }) => {
  const proc = _ptyProcesses.get(ptyId);
  if (proc) proc.write(data);
});

ipcMain.on('terminal:resize', (_event, { ptyId, cols, rows }) => {
  const proc = _ptyProcesses.get(ptyId);
  if (proc) proc.resize(cols, rows);
});

// Write the clipboard image (if any) to a temp PNG and return its path.
// Used by the renderer when the user pastes into the terminal while an image
// is on the clipboard — xterm's default paste pipeline reads text/plain only,
// so screenshots for Claude Code would otherwise be dropped silently.
ipcMain.handle('terminal:saveClipboardImage', async () => {
  try {
    const img = clipboard.readImage();
    if (!img || img.isEmpty()) return { success: false, empty: true };
    const png = img.toPNG();
    if (!png || !png.length) return { success: false, empty: true };
    const filename = `mad-paste-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
    const filepath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(filepath, png);
    return { success: true, path: filepath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Returns the current context of a terminal tab's PTY: its cwd (from
// /proc/<pid>/cwd) and any active ssh descendant. The diff and plan pop-ups
// use this to decide whether to read local or remote ~/.claude data.
ipcMain.handle('terminal:getContext', async (_event, payload = {}) => {
  const ptyId = payload && payload.ptyId;
  if (!ptyId) return { success: false, error: 'ptyId required' };
  const proc = _ptyProcesses.get(ptyId);
  if (!proc) return { success: false, error: 'unknown ptyId' };
  const rootPid = proc.pid;
  const tabSession = await _resolveLocalTabSession(rootPid);
  let ssh = { isSsh: false };
  try { ssh = sshDetect.detectSshContext(rootPid); } catch (err) {
    console.warn('[pty] detectSshContext failed:', err && err.message);
  }
  return { success: true, rootPid, cwd: tabSession.cwd, ssh };
});

// ── Claude Diff Viewer + Plan Viewer IPC ───────────────────────────────────
//
// Two pop-up BrowserWindows: one renders the files touched in Claude's latest
// assistant turn (diff), the other renders a live-watched markdown plan file.
// Neither affects the main window; both shut down with it.

const diffTranscript = require('./claude-diff/transcript');
const diffTurnState = require('./claude-diff/turnState');
const diffLocalSource = require('./claude-diff/localSource');
const planSource = require('./claude-diff/planSource');
const sshDetect = require('./claude-diff/sshDetect');
const sshAuth = require('./claude-diff/sshAuth');
const remoteSource = require('./claude-diff/remoteSource');
const processWalk = require('./claude-diff/processWalk');
const diffWindowModule = require('./windows/diffWindow');
const planWindowModule = require('./windows/planWindow');

// Single popup-owned binding + state. Re-bind on session pick.
const _diffRuntime = {
  scope: null,            // 'local' | 'remote'
  sessionId: null,
  path: null,
  cwd: null,
  remoteKey: null,        // 'user@host:port' when scope === 'remote'
  remoteConnectOpts: null,
  state: diffTurnState.createState(),
  matcher: diffTranscript.createPairMatcher(),
  watcher: null,
  leftover: '',           // for remote line-buffering
  subscribed: false,
  lastPtyId: null,        // stored on diff:openWindow for context resolution
  bindingsByPtyId: new Map(), // ptyId -> { scope, sessionId, path, cwd } — remembers last user pick per tab so re-opens skip the picker
  currentRoundId: null,   // uuid of the most recent real user prompt — stamped onto FileChanges so a round = all edits between two user prompts
};

// Drop a per-tab diff binding when the tab's current (cwd, sessionId) no
// longer matches the cached entry — e.g. the user restarted claude or changed
// directories in the tab. Called from `diff:getTabBinding` so any caller sees
// a null binding rather than stale data.
function _diffInvalidateStaleBinding(ptyId, currentCwd, currentSessionId) {
  if (!ptyId) return;
  const b = _diffRuntime.bindingsByPtyId.get(ptyId);
  if (!b) return;
  if (currentSessionId && b.sessionId && b.sessionId !== currentSessionId) {
    _diffRuntime.bindingsByPtyId.delete(ptyId);
    return;
  }
  if (currentCwd && b.cwd && b.cwd !== currentCwd) {
    _diffRuntime.bindingsByPtyId.delete(ptyId);
  }
}

// Idle-TTL cache of ssh2 handles keyed by connectKey (user@host:port).
const _remoteHandles = new Map();
const REMOTE_IDLE_MS = 5 * 60 * 1000;

async function _getRemoteHandle(connectOpts) {
  const key = sshAuth.connectKey(connectOpts);
  if (!key) throw new Error('Invalid remote connect opts');
  const cached = _remoteHandles.get(key);
  if (cached) {
    if (cached.timer) clearTimeout(cached.timer);
    cached.timer = setTimeout(() => _releaseRemoteHandle(key), REMOTE_IDLE_MS);
    return cached.handle;
  }
  const handle = await remoteSource.openRemote(connectOpts);
  const entry = {
    handle,
    connectOpts,
    timer: setTimeout(() => _releaseRemoteHandle(key), REMOTE_IDLE_MS),
  };
  _remoteHandles.set(key, entry);
  return handle;
}

function _releaseRemoteHandle(key) {
  const entry = _remoteHandles.get(key);
  if (!entry) return;
  _remoteHandles.delete(key);
  try { entry.handle.close(); } catch (_) {}
  if (entry.timer) clearTimeout(entry.timer);
}

function _closeAllRemoteHandles() {
  for (const key of Array.from(_remoteHandles.keys())) _releaseRemoteHandle(key);
}

// Resolve THIS local PTY tab's claude session with a confidence tier. The
// caller uses `tier` to decide whether to auto-bind:
//   sure    — claude PID located AND session file resolved → safe to auto-bind
//   guess   — claude PID located but session file unresolved, or ambiguous →
//             caller opens picker pre-filtered by cwd
//   unknown — no claude process for this tab → picker, no pre-filter
// Non-Linux always returns unknown (no procfs).
async function _resolveLocalTabSession(rootPid) {
  const empty = { tier: 'unknown', claudePid: null, cwd: null, sessionPath: null, sessionId: null };
  if (process.platform !== 'linux' || !Number.isInteger(rootPid)) return empty;
  const { claudePid, tier: pidTier } = await processWalk.resolveLocalClaudePid(rootPid);
  if (!claudePid) return empty;
  const cwd = processWalk.readCwdLink(claudePid);
  const session = processWalk.sessionPathFromPid(claudePid, os.homedir());
  if (session && session.sessionPath) {
    return {
      tier: pidTier === 'sure' ? 'sure' : 'guess',
      claudePid,
      cwd,
      sessionPath: session.sessionPath,
      sessionId: session.sessionId,
    };
  }
  // PID known but session file unresolved → guess, picker pre-filters on cwd.
  return { tier: 'guess', claudePid, cwd, sessionPath: null, sessionId: null };
}

// Resolve a PTY-tab into the context the diff / plan viewers need:
//   { scope: 'local'|'remote', cwd, hostLabel, ssh?, connectOpts?, remoteKey?,
//     tabSession? }
// For local scope, `tabSession` carries the tier + session-file tuple the
// popup uses to auto-bind (or pre-filter the picker). For remote scope the
// popup probes the remote over the ssh handle.
async function _resolveTabContext(ptyId) {
  if (!ptyId) return { scope: 'local', cwd: null, hostLabel: 'local', ssh: { isSsh: false }, tabSession: null };
  const proc = _ptyProcesses.get(ptyId);
  if (!proc) return { scope: 'local', cwd: null, hostLabel: 'local', ssh: { isSsh: false }, tabSession: null };
  const rootPid = proc.pid;
  let ssh = { isSsh: false };
  try { ssh = sshDetect.detectSshContext(rootPid); } catch (_) {}
  if (!ssh.isSsh) {
    const tabSession = await _resolveLocalTabSession(rootPid);
    return { scope: 'local', cwd: tabSession.cwd, hostLabel: 'local', ssh, tabSession };
  }

  let s = null;
  try { s = loadSettings(); } catch (_) { s = null; }
  const webdavTunnelCfg = s && s.webdav && s.webdav.sshTunnel;
  const connectOpts = sshAuth.buildConnectOpts(
    { host: ssh.host, user: ssh.user, port: ssh.port, identityFile: ssh.identityFile },
    { webdavTunnelCfg, currentUser: os.userInfo().username },
  );
  const remoteKey = sshAuth.connectKey(connectOpts);
  const hostLabel = `${connectOpts.username}@${ssh.host}${ssh.port && ssh.port !== 22 ? ':' + ssh.port : ''}`;
  return { scope: 'remote', cwd: null, ssh, connectOpts, remoteKey, hostLabel, tabSession: null };
}

function _diffPushUpdate(payload) {
  const win = diffWindowModule.getDiffWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('diff:updated', payload);
}

function _diffPushError(message) {
  const win = diffWindowModule.getDiffWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('diff:error', { message });
}

function _diffIngestRecord(record) {
  // Round boundary: prefer the CLI-assigned promptId (all records belonging to
  // one human prompt share it, including tool_result carriers and skill-load
  // synthetic user records mid-turn). Fall back to the uuid of a real user
  // prompt record for older transcripts that predate promptId.
  if (record) {
    if (record.promptId) {
      _diffRuntime.currentRoundId = record.promptId;
    } else if (diffTranscript.isUserPromptRecord(record) && record.uuid) {
      _diffRuntime.currentRoundId = record.uuid;
    }
  }
  const pairs = _diffRuntime.matcher.push(record);
  for (const pair of pairs) {
    const changes = diffTranscript.extractChange(pair);
    for (const ch of changes) {
      if (_diffRuntime.currentRoundId) ch.turnId = _diffRuntime.currentRoundId;
      const res = diffTurnState.ingest(_diffRuntime.state, ch);
      if (_diffRuntime.subscribed) {
        _diffPushUpdate({
          tabId: 'popup',
          turnChanged: res.turnChanged,
          filePath: res.filePath,
          editIndex: res.editIndex,
          fileAdded: res.fileAdded,
        });
      }
    }
  }
}

function _diffStartWatching() {
  if (_diffRuntime.watcher || !_diffRuntime.path) return;
  if (_diffRuntime.scope === 'local') {
    _diffRuntime.watcher = diffLocalSource.watchSession(_diffRuntime.path, {
      onRecord: (record) => _diffIngestRecord(record),
      onError: (err) => _diffPushError(err.message || String(err)),
    });
    return;
  }
  if (_diffRuntime.scope === 'remote') {
    const connectOpts = _diffRuntime.remoteConnectOpts;
    if (!connectOpts) { _diffPushError('Remote session binding missing connect options.'); return; }
    // Placeholder so concurrent starts don't race.
    _diffRuntime.watcher = { stop() {} };
    _diffRuntime.leftover = '';
    (async () => {
      try {
        const handle = await _getRemoteHandle(connectOpts);
        const w = remoteSource.watchRemoteFile(handle, _diffRuntime.path, {
          onData: (chunk) => {
            const { records, leftover: next } = diffTranscript.parseLineBuffer(
              (_diffRuntime.leftover || '') + chunk,
            );
            _diffRuntime.leftover = next;
            for (const rec of records) _diffIngestRecord(rec);
          },
          onError: (err) => _diffPushError(err.message || String(err)),
          onRemoved: () => _diffPushError('Remote session file was removed.'),
        });
        _diffRuntime.watcher = w;
      } catch (err) {
        _diffRuntime.watcher = null;
        _diffPushError(err.message || String(err));
      }
    })();
  }
}

function _diffStopWatching() {
  if (_diffRuntime.watcher) {
    try { _diffRuntime.watcher.stop(); } catch {}
    _diffRuntime.watcher = null;
  }
  _diffRuntime.leftover = '';
}

function _diffResetBinding() {
  _diffStopWatching();
  _diffRuntime.state = diffTurnState.createState();
  _diffRuntime.matcher = diffTranscript.createPairMatcher();
  _diffRuntime.currentRoundId = null;
  _diffRuntime.subscribed = false;
}

// Route popup-local accelerator clicks back through the main window so it can
// inject the active terminal tab's ptyId, same path as the App menu click.
function _popupForwardOpenDiff() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:openDiffWindow');
  } else {
    try { _diffOpenWindow(); } catch (_) {}
  }
}
function _popupForwardOpenPlan() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:openPlanWindow');
  } else {
    try { _planOpenWindow(); } catch (_) {}
  }
}

function _diffOpenWindow() {
  if (!mainWindow) return null;
  const win = diffWindowModule.getOrCreateDiffWindow({
    parentWindow: mainWindow,
    loadSettings,
    saveSettings,
    onOpenDiff: _popupForwardOpenDiff,
    onOpenPlan: _popupForwardOpenPlan,
    onCycleFocus: _cycleWindowFocus,
  });
  return win;
}

// Cycle keyboard focus across the currently-open app windows in a fixed
// order: main → diff → plan → main. Closed/destroyed windows are skipped.
// No-op when only one app window is open. Wired to CmdOrCtrl+` from both
// the main app menu and each popup's hidden local menu.
function _cycleWindowFocus() {
  const order = [
    mainWindow,
    diffWindowModule.getDiffWindow && diffWindowModule.getDiffWindow(),
    planWindowModule.getPlanWindow && planWindowModule.getPlanWindow(),
  ].filter((w) => w && !w.isDestroyed());
  if (order.length < 2) {
    console.error('[cycle-diag] early-return: order.length=' + order.length);
    return;
  }
  const focused = BrowserWindow.getFocusedWindow();
  const idx = order.findIndex((w) => w === focused);
  const next = order[(idx + 1 + order.length) % order.length];
  const label = (w) => (w === mainWindow ? 'main' : (w === (diffWindowModule.getDiffWindow && diffWindowModule.getDiffWindow()) ? 'diff' : (w === (planWindowModule.getPlanWindow && planWindowModule.getPlanWindow()) ? 'plan' : `other(title=${(() => { try { return w && w.getTitle && w.getTitle(); } catch (_) { return '?'; } })()})`)));
  console.error('[cycle-diag] order=' + order.map(label).join(',') + ' focused=' + (focused ? label(focused) : 'null') + ' idx=' + idx + ' next=' + label(next));
  if (next.isMinimized()) next.restore();
  next.show();
  next.focus();
  setTimeout(() => {
    try {
      const after = BrowserWindow.getFocusedWindow();
      console.error('[cycle-diag] post-focus: focused=' + (after ? label(after) : 'null') + ' next.isVisible=' + next.isVisible() + ' next.isFocused=' + next.isFocused());
    } catch (err) {
      console.error('[cycle-diag] post-focus error: ' + err.message);
    }
  }, 100);
}

// ── Plan runtime ───────────────────────────────────────────────────────────
//
// Per-terminal-tab plan binding. Each tab remembers which plan it was last
// showing; switching tabs re-displays that tab's plan. The window itself is
// still a singleton — only the binding is per-tab. The watcher is ephemeral
// and lives only for the currently-displayed tab.

const _planTabBindings = new Map(); // ptyId → { path, scope, name, hostLabel, remoteConnectOpts?, remoteKey? }
let _planActiveTabId = null;
let _planActiveWatcher = null;      // { ptyId, watcher }

function _planPushUpdate(payload) {
  const win = planWindowModule.getPlanWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('plan:updated', payload);
}

function _planPushError(message) {
  const win = planWindowModule.getPlanWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('plan:error', { message });
}

function _planPushRemoved() {
  const win = planWindowModule.getPlanWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('plan:removed', {});
}

function _planPushTabSwitched(payload) {
  const win = planWindowModule.getPlanWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('plan:tabSwitched', payload);
}

function _planPushNoBinding() {
  const win = planWindowModule.getPlanWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('plan:noBinding', {});
}

function _planStopActiveWatcher() {
  if (_planActiveWatcher) {
    try { _planActiveWatcher.watcher.stop(); } catch {}
    _planActiveWatcher = null;
  }
}

function _planReleaseTab(ptyId) {
  if (ptyId == null) return;
  if (_planActiveWatcher && _planActiveWatcher.ptyId === ptyId) _planStopActiveWatcher();
  _planTabBindings.delete(ptyId);
  if (_planActiveTabId === ptyId) _planActiveTabId = null;
}

// Auto-pick the latest plan written by THIS tab's Claude session. "Latest" =
// most-recent mtime among plan files touched by Write/Edit/MultiEdit tool
// calls in the session's JSONL. Returns null when the session can't be
// pinned (tier guess/unknown) or the session has no plan yet — the caller
// then falls back to the picker. Binding carries cwd + sessionId so stale
// caches can be detected on re-open.
async function _planAutoPickLatest(ptyId) {
  try {
    const ctx = await _resolveTabContext(ptyId);
    if (ctx.scope === 'local') {
      const ts = ctx.tabSession;
      if (!ts || ts.tier !== 'sure' || !ts.sessionPath) return null;
      const plans = planSource.listPlansForSession({ sessionPath: ts.sessionPath });
      if (!plans.length) return null;
      const top = plans[0];
      const binding = {
        path: top.path,
        scope: 'local',
        name: top.slug || top.name,
        hostLabel: 'local',
        cwd: ts.cwd || null,
        sessionId: ts.sessionId || null,
      };
      _planTabBindings.set(ptyId, binding);
      return binding;
    }
    if (ctx.scope === 'remote' && ctx.connectOpts && !ctx.connectOpts.authError) {
      const sourcePort = sshDetect.readSshSourcePort(ctx.ssh && ctx.ssh.pid);
      const handle = await _getRemoteHandle(ctx.connectOpts);
      const remoteHome = await remoteSource.resolveRemoteHome(handle);
      let probe = { tier: 'unknown', sessionPath: null, cwd: null };
      try { probe = await remoteSource.probeRemoteTabSession(handle, sourcePort); }
      catch (_) { /* degrade */ }
      if (probe.tier !== 'sure' || !probe.sessionPath) return null;
      const plans = await remoteSource.listRemotePlansForSession(handle, {
        remoteSessionPath: probe.sessionPath,
        remotePlansDir: `${remoteHome}/.claude/plans`,
      });
      if (!plans || !plans.length) return null;
      const top = plans[0];
      const sessionId = (probe.sessionPath.split('/').pop() || '').replace(/\.jsonl$/, '') || null;
      const binding = {
        path: top.path,
        scope: 'remote',
        name: top.slug || top.name,
        hostLabel: ctx.hostLabel,
        remoteConnectOpts: ctx.connectOpts,
        remoteKey: ctx.remoteKey,
        cwd: probe.cwd || null,
        sessionId,
      };
      _planTabBindings.set(ptyId, binding);
      return binding;
    }
  } catch (_) { /* fall through */ }
  return null;
}

function _planOpenWindow() {
  if (!mainWindow) return null;
  return planWindowModule.getOrCreatePlanWindow({
    parentWindow: mainWindow,
    loadSettings,
    saveSettings,
    onOpenDiff: _popupForwardOpenDiff,
    onOpenPlan: _popupForwardOpenPlan,
    onCycleFocus: _cycleWindowFocus,
  });
}

// ── Diff IPC handlers ──────────────────────────────────────────────────────

ipcMain.handle('diff:openWindow', async (_event, payload = {}) => {
  try {
    const newPtyId = (payload && Object.prototype.hasOwnProperty.call(payload, 'ptyId'))
      ? (payload.ptyId || null) : _diffRuntime.lastPtyId;
    const prevPtyId = _diffRuntime.lastPtyId;
    _diffRuntime.lastPtyId = newPtyId;
    const existingWin = diffWindowModule.getDiffWindow && diffWindowModule.getDiffWindow();
    const windowWasOpen = !!(existingWin && !existingWin.isDestroyed());
    _diffOpenWindow();
    // If the window was already open and the tab changed, tell the renderer to
    // re-run auto-detect against the new tab's context. (On first open the
    // renderer's own boot() handles this.)
    if (windowWasOpen && newPtyId !== prevPtyId) {
      const win = diffWindowModule.getDiffWindow && diffWindowModule.getDiffWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('diff:tabSwitched', { ptyId: newPtyId });
      }
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message || String(e) }; }
});

ipcMain.handle('diff:closeWindow', async () => {
  try { diffWindowModule.closeDiffWindow(); return { success: true }; }
  catch (e) { return { success: false, error: e.message || String(e) }; }
});

ipcMain.handle('diff:togglePin', async () => {
  try {
    const pinned = diffWindowModule.toggleDiffPin({ loadSettings, saveSettings });
    return { success: true, pinned };
  } catch (e) { return { success: false, error: e.message || String(e) }; }
});

// Resolve THIS tab's Claude session with a confidence tier. The popup uses
// `tier === 'sure'` to auto-bind; otherwise it opens the picker (pre-filtered
// on cwd when `guess`).
ipcMain.handle('diff:resolveTabSession', async (_event, payload = {}) => {
  const ptyId = (payload && payload.ptyId) || _diffRuntime.lastPtyId;
  try {
    const ctx = await _resolveTabContext(ptyId);
    if (ctx.scope === 'local') {
      const ts = ctx.tabSession || { tier: 'unknown', cwd: null, sessionPath: null, sessionId: null };
      return {
        success: true,
        tier: ts.tier,
        scope: 'local',
        sessionPath: ts.sessionPath,
        sessionId: ts.sessionId,
        cwd: ts.cwd,
        context: { scope: 'local', cwd: ts.cwd, hostLabel: 'local' },
      };
    }
    // Remote: need live ssh handle + source port of this tab's ssh client.
    if (!ctx.connectOpts || ctx.connectOpts.authError) {
      const err = (ctx.connectOpts && ctx.connectOpts.authError) || 'Could not build SSH connect options.';
      return {
        success: false,
        error: err,
        scope: 'remote',
        context: { scope: 'remote', hostLabel: ctx.hostLabel || null },
      };
    }
    const sourcePort = sshDetect.readSshSourcePort(ctx.ssh && ctx.ssh.pid);
    const handle = await _getRemoteHandle(ctx.connectOpts);
    const remoteHome = await remoteSource.resolveRemoteHome(handle);
    let probe = { tier: 'unknown', sessionPath: null, cwd: null };
    try { probe = await remoteSource.probeRemoteTabSession(handle, sourcePort); }
    catch (_) { /* degrade to unknown */ }
    let sessionId = null;
    if (probe.sessionPath) {
      const m = /\/([^/]+)\.jsonl$/.exec(probe.sessionPath);
      if (m) sessionId = m[1];
    }
    return {
      success: true,
      tier: probe.tier || 'unknown',
      scope: 'remote',
      sessionPath: probe.sessionPath || null,
      sessionId,
      cwd: probe.cwd || null,
      context: {
        scope: 'remote',
        hostLabel: ctx.hostLabel,
        cwd: probe.cwd || null,
        remoteHome,
        remoteKey: ctx.remoteKey,
      },
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('diff:listSessions', async (_event, payload = {}) => {
  const ptyId = (payload && payload.ptyId) || _diffRuntime.lastPtyId;
  try {
    const ctx = await _resolveTabContext(ptyId);
    if (ctx.scope === 'local') {
      const sessions = await diffLocalSource.listSessions({ limit: 20, projectCwd: ctx.cwd });
      return {
        success: true,
        scope: 'local',
        sessions,
        context: { scope: 'local', cwd: ctx.cwd, hostLabel: 'local' },
      };
    }
    // Remote.
    if (!ctx.connectOpts || ctx.connectOpts.authError) {
      const err = (ctx.connectOpts && ctx.connectOpts.authError) || 'Could not build SSH connect options.';
      return {
        success: false,
        error: err,
        scope: 'remote',
        context: { scope: 'remote', hostLabel: ctx.hostLabel || null },
      };
    }
    const handle = await _getRemoteHandle(ctx.connectOpts);
    const remoteHome = await remoteSource.resolveRemoteHome(handle);
    // Prefer a tab-scoped probe so the picker tops the project in THIS tab's
    // visible tmux pane, not whichever claude started most recently on the
    // host. Falls back to host-scoped when the tab-scoped probe can't answer
    // (no ssh source port, non-Linux remote, no claude in this tmux, etc.).
    const sourcePort = sshDetect.readSshSourcePort(ctx.ssh && ctx.ssh.pid);
    let remoteCwd = null;
    try {
      const probe = await remoteSource.probeRemoteTabSession(handle, sourcePort);
      if (probe && probe.cwd) remoteCwd = probe.cwd;
    } catch (_) { /* fall through to host-scoped */ }
    if (!remoteCwd) {
      remoteCwd = await remoteSource.probeRemoteClaudeCwd(handle);
    }
    const sessions = await remoteSource.listRemoteSessions(handle, { remoteHome, projectCwd: remoteCwd, limit: 40 });
    return {
      success: true,
      scope: 'remote',
      sessions,
      context: {
        scope: 'remote',
        hostLabel: ctx.hostLabel,
        cwd: remoteCwd,
        remoteHome,
        remoteKey: ctx.remoteKey,
      },
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('diff:bindSession', async (_event, { scope, sessionId, path: sessionPath, cwd, ptyId } = {}) => {
  if (!sessionPath) return { success: false, error: 'path is required' };
  try {
    _diffResetBinding();
    _diffRuntime.scope = scope || 'local';
    _diffRuntime.sessionId = sessionId || null;
    _diffRuntime.path = sessionPath;
    _diffRuntime.cwd = cwd || null;
    _diffRuntime.remoteConnectOpts = null;
    _diffRuntime.remoteKey = null;
    if (_diffRuntime.scope === 'remote') {
      const ctx = await _resolveTabContext(ptyId || _diffRuntime.lastPtyId);
      if (ctx.scope !== 'remote' || !ctx.connectOpts) {
        return { success: false, error: 'Terminal tab is no longer SSHed into a remote host.' };
      }
      if (ctx.connectOpts.authError) {
        return { success: false, error: ctx.connectOpts.authError };
      }
      _diffRuntime.remoteConnectOpts = ctx.connectOpts;
      _diffRuntime.remoteKey = ctx.remoteKey;
    }
    try {
      const s = loadSettings();
      s.diffViewer = s.diffViewer || {};
      // Only persist local bindings — remote requires a live ssh context.
      if (_diffRuntime.scope === 'local') {
        s.diffViewer.lastBinding = {
          scope: 'local',
          sessionId: _diffRuntime.sessionId,
          path: _diffRuntime.path,
          cwd: _diffRuntime.cwd,
        };
      } else {
        s.diffViewer.lastBinding = null;
      }
      saveSettings(s);
    } catch (_) {}
    // Remember this pick per-tab so re-opening the popup on the same tab skips
    // the picker. The popup BrowserWindow has no ptyId of its own, so fall
    // back to `_diffRuntime.lastPtyId` (set by `diff:openWindow` to the tab
    // the viewer was opened for) — same pattern as `_planTabBindings`.
    const tabKey = ptyId || _diffRuntime.lastPtyId;
    if (tabKey) {
      _diffRuntime.bindingsByPtyId.set(tabKey, {
        scope: _diffRuntime.scope,
        sessionId: _diffRuntime.sessionId,
        path: _diffRuntime.path,
        cwd: _diffRuntime.cwd,
        remoteKey: _diffRuntime.remoteKey || null,
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('diff:getBinding', async () => {
  if (_diffRuntime.path) {
    return {
      success: true,
      binding: {
        scope: _diffRuntime.scope,
        sessionId: _diffRuntime.sessionId,
        path: _diffRuntime.path,
        cwd: _diffRuntime.cwd,
      },
    };
  }
  try {
    const s = loadSettings();
    const last = s.diffViewer && s.diffViewer.lastBinding;
    if (last && last.path) {
      _diffRuntime.scope = last.scope || 'local';
      _diffRuntime.sessionId = last.sessionId || null;
      _diffRuntime.path = last.path;
      _diffRuntime.cwd = last.cwd || null;
      return { success: true, binding: last };
    }
  } catch (_) {}
  return { success: true, binding: null };
});

// Look up the remembered binding for a specific terminal tab (ptyId). Used by
// the popup on re-open so the user doesn't have to re-pick the session they
// already chose for this tab. Mirrors `plan:getCurrent`: when the renderer
// omits ptyId, fall back to `_diffRuntime.lastPtyId`, which was set by
// `diff:openWindow` to identify the tab the user just opened the viewer for.
ipcMain.handle('diff:getTabBinding', async (_event, payload = {}) => {
  const ptyId = (payload && payload.ptyId) || _diffRuntime.lastPtyId;
  if (!ptyId) return { success: true, binding: null };
  // Resolve the tab's current (cwd, sessionId) and drop the cached entry if
  // it's stale (claude restarted, cwd changed, etc.). Swallow errors — a
  // failed probe should leave the cache alone rather than falsely invalidate.
  try {
    const ctx = await _resolveTabContext(ptyId);
    const cwd = ctx.scope === 'local'
      ? (ctx.tabSession && ctx.tabSession.cwd) || null
      : null;
    const sessionId = ctx.scope === 'local'
      ? (ctx.tabSession && ctx.tabSession.sessionId) || null
      : null;
    _diffInvalidateStaleBinding(ptyId, cwd, sessionId);
  } catch (_) { /* leave cache intact on probe failure */ }
  const b = _diffRuntime.bindingsByPtyId.get(ptyId);
  return { success: true, binding: b || null };
});

ipcMain.handle('diff:clearBinding', async () => {
  _diffResetBinding();
  _diffRuntime.scope = null;
  _diffRuntime.sessionId = null;
  _diffRuntime.path = null;
  _diffRuntime.cwd = null;
  if (_diffRuntime.lastPtyId) _diffRuntime.bindingsByPtyId.delete(_diffRuntime.lastPtyId);
  return { success: true };
});

ipcMain.handle('diff:snapshot', async () => {
  if (!_diffRuntime.path) return { success: false, error: 'No session bound' };
  try { return { success: true, ...diffTurnState.snapshot(_diffRuntime.state) }; }
  catch (err) { return { success: false, error: err.message || String(err) }; }
});

ipcMain.handle('diff:getHunks', async (_event, { filePath } = {}) => {
  if (!_diffRuntime.path) return { success: false, error: 'No session bound' };
  try {
    const detail = diffTurnState.getHunks(_diffRuntime.state, filePath);
    if (!detail) return { success: false, error: 'File not found in current turn' };
    return { success: true, ...detail };
  } catch (err) { return { success: false, error: err.message || String(err) }; }
});

ipcMain.handle('diff:subscribe', async () => {
  if (!_diffRuntime.path) return { success: false, error: 'No session bound' };
  _diffRuntime.subscribed = true;
  _diffStartWatching();
  return { success: true };
});

ipcMain.handle('diff:unsubscribe', async () => {
  _diffRuntime.subscribed = false;
  _diffStopWatching();
  return { success: true };
});

// ── Plan IPC handlers ──────────────────────────────────────────────────────

ipcMain.handle('plan:openWindow', async (_event, payload = {}) => {
  try {
    const ptyId = (payload && Object.prototype.hasOwnProperty.call(payload, 'ptyId')) ? (payload.ptyId || null) : _planActiveTabId;
    const prevTabId = _planActiveTabId;
    const tabChanged = prevTabId !== ptyId;
    _planActiveTabId = ptyId;
    const existingWindow = planWindowModule.getPlanWindow();
    const firstOpen = !existingWindow || existingWindow.isDestroyed();
    _planOpenWindow();
    if (tabChanged) _planStopActiveWatcher();
    if (firstOpen) return { success: true };
    // Window already open. Prefer a freshly-resolved latest plan for this
    // tab's current Claude session; fall back to the tab's remembered
    // binding (auto-picked or manual) when auto-pick can't run — e.g. Mac
    // (tier always 'unknown') or a tab where Claude hasn't written a plan
    // yet but we previously bound to one.
    if (ptyId != null) {
      let picked = await _planAutoPickLatest(ptyId);
      if (!picked) {
        const cached = _planTabBindings.get(ptyId);
        if (cached && cached.path) picked = cached;
      }
      if (picked) {
        _planPushTabSwitched({ path: picked.path, scope: picked.scope, name: picked.name, hostLabel: picked.hostLabel });
      } else {
        _planPushNoBinding();
      }
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message || String(e) }; }
});

ipcMain.handle('plan:closeWindow', async () => {
  try { planWindowModule.closePlanWindow(); return { success: true }; }
  catch (e) { return { success: false, error: e.message || String(e) }; }
});

ipcMain.handle('plan:togglePin', async () => {
  try {
    const pinned = planWindowModule.togglePlanPin({ loadSettings, saveSettings });
    return { success: true, pinned };
  } catch (e) { return { success: false, error: e.message || String(e) }; }
});

// Resolve THIS tab's Claude tab-session for the plan viewer. Plans live
// under ~/.claude/plans/ and aren't 1:1 with a session, so we only need the
// tier + cwd for picker pre-filtering.
ipcMain.handle('plan:resolveTabSession', async (_event, payload = {}) => {
  const ptyId = (payload && payload.ptyId) || _planActiveTabId;
  try {
    const ctx = await _resolveTabContext(ptyId);
    if (ctx.scope === 'local') {
      const ts = ctx.tabSession || { tier: 'unknown', cwd: null };
      return {
        success: true,
        tier: ts.tier,
        scope: 'local',
        cwd: ts.cwd,
        context: { scope: 'local', cwd: ts.cwd, hostLabel: 'local' },
      };
    }
    if (!ctx.connectOpts || ctx.connectOpts.authError) {
      const err = (ctx.connectOpts && ctx.connectOpts.authError) || 'Could not build SSH connect options.';
      return { success: false, error: err, scope: 'remote', context: { scope: 'remote', hostLabel: ctx.hostLabel || null } };
    }
    const sourcePort = sshDetect.readSshSourcePort(ctx.ssh && ctx.ssh.pid);
    const handle = await _getRemoteHandle(ctx.connectOpts);
    const remoteHome = await remoteSource.resolveRemoteHome(handle);
    let probe = { tier: 'unknown', sessionPath: null, cwd: null };
    try { probe = await remoteSource.probeRemoteTabSession(handle, sourcePort); }
    catch (_) { /* degrade to unknown */ }
    return {
      success: true,
      tier: probe.tier || 'unknown',
      scope: 'remote',
      cwd: probe.cwd || null,
      context: { scope: 'remote', hostLabel: ctx.hostLabel, cwd: probe.cwd || null, remoteHome, remoteKey: ctx.remoteKey },
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('plan:listPlans', async (_event, payload = {}) => {
  const ptyId = (payload && payload.ptyId) || _planActiveTabId;
  try {
    const ctx = await _resolveTabContext(ptyId);
    if (ctx.scope === 'local') {
      return {
        success: true,
        scope: 'local',
        plans: planSource.listPlans({ projectCwd: ctx.cwd || null }),
        context: { scope: 'local', hostLabel: 'local', cwd: ctx.cwd || null },
      };
    }
    if (!ctx.connectOpts || ctx.connectOpts.authError) {
      const err = (ctx.connectOpts && ctx.connectOpts.authError) || 'Could not build SSH connect options.';
      return { success: false, error: err, scope: 'remote', context: { scope: 'remote', hostLabel: ctx.hostLabel || null } };
    }
    const handle = await _getRemoteHandle(ctx.connectOpts);
    const remoteHome = await remoteSource.resolveRemoteHome(handle);
    const plans = await remoteSource.listRemotePlans(handle, { remoteHome });
    return {
      success: true,
      scope: 'remote',
      plans,
      context: { scope: 'remote', hostLabel: ctx.hostLabel, remoteHome, remoteKey: ctx.remoteKey },
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('plan:loadPlan', async (_event, pathArg) => {
  const planPath = typeof pathArg === 'string' ? pathArg : (pathArg && pathArg.path);
  const ptyId = ((pathArg && typeof pathArg === 'object') ? pathArg.ptyId : null) || _planActiveTabId;
  const scope = (pathArg && typeof pathArg === 'object') ? pathArg.scope : 'local';
  if (!planPath) return { success: false, error: 'path is required' };
  try {
    let content, mtime;
    let remoteConnectOpts = null, remoteKey = null, hostLabel = 'local';
    if (scope === 'remote') {
      const ctx = await _resolveTabContext(ptyId);
      if (ctx.scope !== 'remote' || !ctx.connectOpts || ctx.connectOpts.authError) {
        return { success: false, error: (ctx.connectOpts && ctx.connectOpts.authError) || 'Remote context unavailable.' };
      }
      const handle = await _getRemoteHandle(ctx.connectOpts);
      content = await remoteSource.readRemoteFile(handle, planPath);
      mtime = null;
      remoteConnectOpts = ctx.connectOpts;
      remoteKey = ctx.remoteKey;
      hostLabel = ctx.hostLabel;
    } else {
      content = await planSource.readPlan(planPath);
      const st = fs.statSync(planSource.expandHome(planPath));
      mtime = st.mtime.toISOString();
    }
    // Remember this choice for the tab that opened it.
    if (ptyId != null) {
      _planTabBindings.set(ptyId, {
        path: planPath,
        scope: scope === 'remote' ? 'remote' : 'local',
        name: (typeof pathArg === 'object' && pathArg.name) ? pathArg.name : (planPath.split('/').pop() || planPath),
        hostLabel,
        remoteConnectOpts,
        remoteKey,
      });
    }
    return { success: true, content, mtime, path: planPath, scope: scope === 'remote' ? 'remote' : 'local' };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('plan:watchPlan', async (_event, pathArg) => {
  const planPath = typeof pathArg === 'string' ? pathArg : (pathArg && pathArg.path);
  const ptyId = ((pathArg && typeof pathArg === 'object') ? pathArg.ptyId : null) || _planActiveTabId;
  const scope = (pathArg && typeof pathArg === 'object') ? pathArg.scope : 'local';
  if (!planPath) return { success: false, error: 'path is required' };
  if (ptyId == null) return { success: false, error: 'no active tab' };
  try {
    // Install the watcher only for the currently-active tab (singleton).
    _planStopActiveWatcher();
    if (scope === 'remote') {
      const binding = _planTabBindings.get(ptyId);
      const connectOpts = (binding && binding.remoteConnectOpts) || null;
      if (!connectOpts || connectOpts.authError) {
        const ctx = await _resolveTabContext(ptyId);
        if (ctx.scope !== 'remote' || !ctx.connectOpts || ctx.connectOpts.authError) {
          return { success: false, error: (ctx.connectOpts && ctx.connectOpts.authError) || 'Remote context unavailable.' };
        }
        const handle = await _getRemoteHandle(ctx.connectOpts);
        _planActiveWatcher = { ptyId, watcher: remoteSource.watchRemotePlan(handle, planPath, {
          onChange: (data) => _planPushUpdate({ ...data, path: planPath }),
          onError: (err) => _planPushError(err.message || String(err)),
          onRemoved: () => _planPushRemoved(),
        }) };
      } else {
        const handle = await _getRemoteHandle(connectOpts);
        _planActiveWatcher = { ptyId, watcher: remoteSource.watchRemotePlan(handle, planPath, {
          onChange: (data) => _planPushUpdate({ ...data, path: planPath }),
          onError: (err) => _planPushError(err.message || String(err)),
          onRemoved: () => _planPushRemoved(),
        }) };
      }
      return { success: true };
    }
    _planActiveWatcher = { ptyId, watcher: planSource.watchPlan(planPath, {
      onChange: (data) => _planPushUpdate({ ...data, path: planPath }),
      onError: (err) => _planPushError(err.message || String(err)),
      onRemoved: () => _planPushRemoved(),
    }) };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('plan:unwatchPlan', async () => {
  _planStopActiveWatcher();
  return { success: true };
});

ipcMain.handle('plan:getCurrent', async () => {
  try {
    if (_planActiveTabId == null) return { success: true, path: null };
    // First-open boot: try the freshest plan for the tab's current Claude
    // session; fall back to the tab's remembered binding when auto-pick
    // can't run (Mac / tier unknown / no session-authored plan yet).
    let picked = await _planAutoPickLatest(_planActiveTabId);
    if (!picked || !picked.path) {
      const cached = _planTabBindings.get(_planActiveTabId);
      if (cached && cached.path) picked = cached;
    }
    if (!picked || !picked.path) return { success: true, path: null };
    return { success: true, path: picked.path, name: picked.name, scope: picked.scope, hostLabel: picked.hostLabel };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

// ── Pages mode IPC (sources from tracker directory) ─────────────────────────

ipcMain.handle('pages:loadPage', async (_event, { pagePath }) => {
  const fullPath = path.join(TRACKER_DIR(), pagePath + '.md');
  if (!fs.existsSync(fullPath)) return { success: false, error: 'File not found' };
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8'); // follows symlinks for local files
    const { data: frontMatter, content: markdownContent } = parseFrontMatter(raw);
    return {
      success: true,
      markdownContent,
      frontMatter,
      layoutHtml: null,
      siteData: {},
      resolvedPath: pagePath,
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('pages:listFiles', async () => {
  const registry = loadRegistry();
  const files = registry
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .map((e) => ({
      path: e.trackerRelPath.replace(/\.md$/, ''),
      title: e.title,
      date: e.lastSeen.slice(0, 10),
      excerpt: e.excerpt,
      folder: e.source,
      source: e.source,
      openCount: e.openCount,
      wordCount: e.wordCount,
      tags: e.tags,
      originalPath: e.originalPath,
      id: e.id,
    }));
  return { success: true, files, rootName: 'Library' };
});

// ── Tracker IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('tracker:registry', () => loadRegistry());

ipcMain.handle('tracker:syncRemote', async (_event, { id }) => {
  const registry = loadRegistry();
  const entry = registry.find((e) => e.id === id);
  if (!entry) return { success: false, error: 'Entry not found' };
  try {
    if (entry.source === 'cloud') {
      if (!_fekInMemory) return { success: false, error: 'Not logged in to cloud.' };
      const settings = loadSettings();
      await maybeRefreshToken(settings);
      const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
      const resp = await fetch(`${base}/api/v1/files/${encodeURIComponent(entry.cloudKey)}`, {
        headers: { Authorization: `Bearer ${settings.cloud.accessToken}` },
      });
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      const data = await resp.json();
      const plaintext = decryptWithFek(data.content, data.iv, _fekInMemory);
      await trackFile('cloud', entry.originalPath, entry.fileName, plaintext, {
        cloudKey: entry.cloudKey,
      });
    } else if (entry.source === 'webdav') {
      const settings = loadSettings();
      const client = await getWebdavClient(settings);
      const baseUrl = (settings.webdav.url || '').replace(/\/$/, '');
      const remotePath = entry.originalPath.replace(baseUrl, '');
      const content = await withTimeout(
        client.getFileContents(remotePath, { format: 'text' }),
        WEBDAV_REQUEST_TIMEOUT_MS,
        'Timed out refreshing this WebDAV file.'
      );
      await trackFile('webdav', entry.originalPath, entry.fileName, content, {
        host: entry.webdavHost,
      });
    } else {
      return { success: false, error: 'Local files do not need syncing.' };
    }
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
  return { success: true };
});

// ── Cloud IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('cloud:register', async (_event, { email, password }) => {
  const settings = loadSettings();
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.' };
  try {
    const resp = await fetch(`${base}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok)
      return { success: false, error: data.error || data.message || `HTTP ${resp.status}` };
    settings.cloud.email = data.email;
    settings.cloud.userId = data.user_id;
    settings.cloud.encryptedFek = data.encrypted_fek;
    settings.cloud.fekIv = data.fek_iv;
    settings.cloud.fekSalt = data.fek_salt;
    saveSettings(settings);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cloud:login', async (_event, { email, password }) => {
  const settings = loadSettings();
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.' };
  try {
    const resp = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok)
      return { success: false, error: data.error || data.message || `HTTP ${resp.status}` };
    settings.cloud.email = data.email;
    settings.cloud.userId = data.user_id;
    settings.cloud.accessToken = data.access_token;
    settings.cloud.refreshToken = data.refresh_token;
    settings.cloud.tokenExpiresAt = data.expires_at;
    settings.cloud.encryptedFek = data.encrypted_fek;
    settings.cloud.fekIv = data.fek_iv;
    settings.cloud.fekSalt = data.fek_salt;
    saveSettings(settings);
    const kek = deriveKek(password, data.user_id, data.fek_salt);
    _fekInMemory = decryptFek(data.encrypted_fek, data.fek_iv, kek);
    return { success: true, email: data.email };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cloud:logout', async () => {
  const settings = loadSettings();
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (base && settings.cloud.accessToken) {
    try {
      await fetch(`${base}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.cloud.accessToken}` },
      });
    } catch (_) {}
  }
  _fekInMemory = null;
  settings.cloud.accessToken = '';
  settings.cloud.refreshToken = '';
  settings.cloud.tokenExpiresAt = '';
  settings.cloud.encryptedFek = '';
  settings.cloud.fekIv = '';
  settings.cloud.fekSalt = '';
  settings.cloud.userId = '';
  saveSettings(settings);
  return { success: true };
});

ipcMain.handle('cloud:isLoggedIn', () => {
  return { loggedIn: !!_fekInMemory };
});

ipcMain.handle('cloud:testConnection', async () => {
  const settings = loadSettings();
  await maybeRefreshToken(settings);
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.' };
  if (!settings.cloud.accessToken) return { success: false, error: 'Not logged in.' };
  try {
    const t0 = Date.now();
    const resp = await fetch(`${base}/api/v1/user/profile`, {
      headers: { Authorization: `Bearer ${settings.cloud.accessToken}` },
    });
    const latencyMs = Date.now() - t0;
    const data = await resp.json();
    if (!resp.ok) return { success: false, error: data.error || `HTTP ${resp.status}` };
    return { success: true, email: data.email, latencyMs };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cloud:listFiles', async () => {
  const settings = loadSettings();
  await maybeRefreshToken(settings);
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.', files: [] };
  if (!settings.cloud.accessToken) return { success: false, error: 'Not logged in.', files: [] };
  try {
    const resp = await fetch(`${base}/api/v1/files/metadata`, {
      headers: { Authorization: `Bearer ${settings.cloud.accessToken}` },
    });
    const data = await resp.json();
    if (!resp.ok) return { success: false, error: data.error || `HTTP ${resp.status}`, files: [] };
    return { success: true, files: data.files || [] };
  } catch (err) {
    return { success: false, error: err.message || String(err), files: [] };
  }
});

ipcMain.handle('cloud:backupFile', async (_event, { key, content }) => {
  if (!_fekInMemory) return { success: false, error: 'Not logged in.' };
  const settings = loadSettings();
  await maybeRefreshToken(settings);
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.' };
  try {
    const { iv, content: encContent } = encryptWithFek(content, _fekInMemory);
    const resp = await fetch(`${base}/api/v1/files/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.cloud.accessToken}`,
      },
      body: JSON.stringify({ content: encContent, iv }),
    });
    const data = await resp.json();
    if (!resp.ok) return { success: false, error: data.error || `HTTP ${resp.status}` };
    trackFile('cloud', `cloud://${key}`, key, content, { cloudKey: key }).catch(() => {});
    return { success: true, filePath: `cloud://${key}`, fileName: key };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cloud:restoreFile', async (_event, { key }) => {
  if (!_fekInMemory) return { success: false, error: 'Not logged in.', content: null };
  const settings = loadSettings();
  await maybeRefreshToken(settings);
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.', content: null };
  try {
    const resp = await fetch(`${base}/api/v1/files/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${settings.cloud.accessToken}` },
    });
    const data = await resp.json();
    if (!resp.ok)
      return { success: false, error: data.error || `HTTP ${resp.status}`, content: null };
    const plaintext = decryptWithFek(data.content, data.iv, _fekInMemory);
    trackFile('cloud', `cloud://${key}`, key, plaintext, { cloudKey: key }).catch(() => {});
    return { success: true, content: plaintext, filePath: `cloud://${key}`, fileName: key };
  } catch (err) {
    return { success: false, error: err.message || String(err), content: null };
  }
});

ipcMain.handle('cloud:deleteFile', async (_event, { key }) => {
  const settings = loadSettings();
  await maybeRefreshToken(settings);
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.' };
  if (!settings.cloud.accessToken) return { success: false, error: 'Not logged in.' };
  try {
    const resp = await fetch(`${base}/api/v1/files/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${settings.cloud.accessToken}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${resp.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cloud:changePassword', async (_event, { oldPassword, newPassword }) => {
  if (!_fekInMemory) return { success: false, error: 'Not logged in.' };
  const settings = loadSettings();
  await maybeRefreshToken(settings);
  const base = (settings.cloud.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return { success: false, error: 'Cloud API URL not configured.' };
  try {
    // Verify old password by re-deriving KEK and checking it decrypts the stored FEK
    const oldKek = deriveKek(oldPassword, settings.cloud.userId, settings.cloud.fekSalt);
    try {
      decryptFek(settings.cloud.encryptedFek, settings.cloud.fekIv, oldKek);
    } catch (_) {
      return { success: false, error: 'Old password is incorrect.' };
    }
    // Re-encrypt FEK with new KEK
    const newSalt = crypto.randomBytes(32).toString('base64');
    const newKek = deriveKek(newPassword, settings.cloud.userId, newSalt);
    const newIv = crypto.randomBytes(12);
    const enc = crypto.createCipheriv('aes-256-gcm', newKek, newIv);
    const ct = Buffer.concat([enc.update(_fekInMemory), enc.final()]);
    const newEncryptedFek = Buffer.concat([ct, enc.getAuthTag()]).toString('base64');
    const newFekIv = newIv.toString('base64');

    const resp = await fetch(`${base}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.cloud.accessToken}`,
      },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
        new_encrypted_fek: newEncryptedFek,
        new_fek_iv: newFekIv,
        new_fek_salt: newSalt,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return { success: false, error: data.error || `HTTP ${resp.status}` };
    settings.cloud.encryptedFek = newEncryptedFek;
    settings.cloud.fekIv = newFekIv;
    settings.cloud.fekSalt = newSalt;
    settings.cloud.accessToken = '';
    settings.cloud.refreshToken = '';
    settings.cloud.tokenExpiresAt = '';
    saveSettings(settings);
    _fekInMemory = null;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

app.whenReady().then(() => {
  initTracker();
  createWindow();
  setTimeout(spawnWorker, 500);
  startSmartRssWorker().catch((e) => console.warn('[smart-rss] start failed', e));
  try {
    _monitorHandle = startMonitor({ app, appVersion: app.getVersion() });
  } catch (_) {
    // monitor is best-effort; never block startup
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  _appQuitting = true;
  closeSshTunnel();
  killTerminalPty();
  _closeAllRemoteHandles();
  if (_worker) {
    try {
      _worker.kill();
    } catch (_) {}
    _worker = null;
  }
  if (_smartRssProc) {
    try { _smartRssProc.kill('SIGTERM'); } catch (_) {}
    _smartRssProc = null;
  }
  if (_monitorHandle) {
    try { _monitorHandle.stop(); } catch (_) {}
    _monitorHandle = null;
  }
});

// Belt-and-suspenders: after our cleanup has run, signal the outer AppImage
// wrapper so it unmounts its FUSE and exits rather than lingering as an
// orphan. Only registered when execPath indicates we are actually running
// from a FUSE-mounted AppImage — in dev, .deb, .tar.gz, macOS, and Windows
// there is no wrapper to signal, and signalling process.ppid in those
// contexts has crashed the Ubuntu desktop (ppid there is gnome-shell /
// systemd --user).
if (shouldRegisterWrapperKill()) {
  app.on('will-quit', () => {
    killAppImageWrapper({ snapshot: _wrapperSnapshot, log: _logWrapperKill });
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
