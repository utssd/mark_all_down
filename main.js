const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Client } = require('ssh2');
const crypto = require('crypto');

// ── Pages mode cache ────────────────────────────────────────────────────────
let _pagesConfigCache = {}; // { [pagesRoot]: siteData object }
let _pagesLayoutCache = {}; // { [absolutePath]: string | null }
let _pagesIncludeCache = {}; // { [absolutePath]: string }

let mainWindow = null;
let pendingFilePath = null;

const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt'];
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const SSH_KEY_PATH = path.join(os.homedir(), '.ssh', 'markalldown_rsa');
const SSH_PUB_KEY_PATH = SSH_KEY_PATH + '.pub';

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf-8'));
  } catch (_) {
    return { sshHost: '', sshUser: '', sshPort: 22, remotePath: '', sshKeyPath: '' };
  }
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Pages mode helpers ──────────────────────────────────────────────────────

async function readPageFile(sftp, absolutePath) {
  if (sftp) return await sftpReadFile(sftp, absolutePath);
  return await fs.promises.readFile(absolutePath, 'utf-8');
}

async function pageFileExists(sftp, absolutePath) {
  if (sftp) return new Promise((resolve) => sftp.stat(absolutePath, (err) => resolve(!err)));
  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
    return true;
  } catch (_) {
    return false;
  }
}

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

// ── SSH helpers ─────────────────────────────────────────────────────────────

function sshKeyExists() {
  try {
    fs.accessSync(SSH_KEY_PATH, fs.constants.R_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function getSshAuthConfig(settings, password) {
  const config = {
    host: settings.sshHost,
    port: settings.sshPort || 22,
    username: settings.sshUser,
  };

  const keyPath = settings.sshKeyPath || SSH_KEY_PATH;
  try {
    fs.accessSync(keyPath, fs.constants.R_OK);
    config.privateKey = fs.readFileSync(keyPath);
  } catch (_) {
    if (password) {
      config.password = password;
    }
  }
  return config;
}

function sshConnect(config) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));
    conn.connect(config);
  });
}

function sftpFromConn(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}

function sftpWriteFile(sftp, remotePath, content) {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(remotePath);
    stream.on('close', () => resolve());
    stream.on('error', (err) => reject(err));
    stream.end(content, 'utf-8');
  });
}

function sftpReadFile(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = sftp.createReadStream(remotePath, { highWaterMark: 65535 });
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', (err) => reject(err));
  });
}

function sftpReaddir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err);
      const base = remotePath.replace(/\/+$/, '');
      const filtered = (list || [])
        .filter((e) => {
          const ext = path.extname(e.filename).toLowerCase();
          return SUPPORTED_EXTENSIONS.includes(ext);
        })
        .map((e) => ({ name: e.filename, path: base + '/' + e.filename }));
      resolve(filtered);
    });
  });
}

function sftpReaddirAll(sftp, dirPath) {
  return new Promise((resolve, reject) => {
    sftp.readdir(dirPath, (err, list) => {
      if (err) return reject(err);
      const base = dirPath.replace(/\/+$/, '');
      resolve(
        (list || []).map((e) => ({
          name: e.filename,
          path: base + '/' + e.filename,
          isDirectory: e.attrs && (e.attrs.mode & 0o170000) === 0o040000,
        }))
      );
    });
  });
}

function sshExec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => {
        stdout += d;
      });
      stream.stderr.on('data', (d) => {
        stderr += d;
      });
      stream.on('close', (code) => resolve({ code, stdout, stderr }));
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
    const content = await fs.promises.readFile(filePath, 'utf-8');
    mainWindow.webContents.send('file:opened', { filePath, content });
  } catch (_) {
    /* unreadable, ignore */
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractFileArg(argv);
    if (filePath && mainWindow) {
      sendFileToRenderer(filePath);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
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

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Markdown File',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:openFile'),
        },
        {
          label: 'Open from SSH…',
          click: () => mainWindow.webContents.send('menu:openFromSsh'),
        },
        {
          label: 'Save As Markdown',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:saveFile'),
        },
        { type: 'separator' },
        { role: 'quit' },
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
  });
}

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || filePaths.length === 0) return null;
  const results = [];
  for (const fp of filePaths) {
    const content = await fs.promises.readFile(fp, 'utf-8');
    results.push({ filePath: fp, content });
  }
  return results;
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

ipcMain.handle('settings:load', async () => {
  const settings = loadSettings();
  settings.hasKey = sshKeyExists();
  return settings;
});

ipcMain.handle('settings:save', async (_event, settings) => {
  saveSettings(settings);
  // Invalidate pages cache whenever settings change
  _pagesConfigCache = {};
  _pagesLayoutCache = {};
  _pagesIncludeCache = {};
  return true;
});

// ── SSH IPC ──

ipcMain.handle('ssh:sync', async (_event, { content, fileName, password }) => {
  const settings = loadSettings();
  if (!settings.sshHost || !settings.sshUser || !settings.remotePath) {
    return { success: false, error: 'SSH settings not configured. Open Settings to configure.' };
  }

  const config = getSshAuthConfig(settings, password);
  let conn;
  try {
    conn = await sshConnect(config);
    const sftp = await sftpFromConn(conn);
    const remoteFull = settings.remotePath.replace(/\/+$/, '') + '/' + fileName;
    await sftpWriteFile(sftp, remoteFull, content);
    conn.end();
    return { success: true };
  } catch (err) {
    if (conn) conn.end();
    const needsPassword = !sshKeyExists() && !password;
    return {
      success: false,
      error: err.message || String(err),
      needsPassword,
    };
  }
});

ipcMain.handle('ssh:testConnection', async (_event, config) => {
  const authConfig = getSshAuthConfig(config, config.password);

  try {
    const conn = await sshConnect(authConfig);
    conn.end();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message || String(err),
      needsPassword: !config.password && !sshKeyExists(),
    };
  }
});

// ── Open from SSH (remote read) ──

ipcMain.handle('remote:sshListFiles', async (_event, { password } = {}) => {
  const settings = loadSettings();
  if (!settings.sshHost || !settings.sshUser || !settings.remotePath) {
    return {
      success: false,
      error: 'SSH settings not configured. Open Settings to configure.',
      files: [],
    };
  }

  const config = getSshAuthConfig(settings, password || undefined);
  let conn;
  try {
    conn = await sshConnect(config);
    const sftp = await sftpFromConn(conn);
    const files = await sftpReaddir(sftp, settings.remotePath.replace(/\/+$/, ''));
    conn.end();
    return { success: true, files };
  } catch (err) {
    if (conn) conn.end();
    const needsPassword = !sshKeyExists();
    return {
      success: false,
      error: err.message || String(err),
      needsPassword,
      files: [],
    };
  }
});

ipcMain.handle('remote:sshReadFile', async (_event, { remotePath, password }) => {
  const settings = loadSettings();
  if (!settings.sshHost || !settings.sshUser || !settings.remotePath) {
    return {
      success: false,
      error: 'SSH settings not configured. Open Settings to configure.',
      filePath: null,
      content: null,
      fileName: null,
    };
  }

  const basePath = settings.remotePath.replace(/\/+$/, '');
  const fullPath = remotePath.startsWith('/') ? remotePath : basePath + '/' + remotePath;

  const config = getSshAuthConfig(settings, password || undefined);
  let conn;
  try {
    conn = await sshConnect(config);
    const sftp = await sftpFromConn(conn);
    const content = await sftpReadFile(sftp, fullPath);
    conn.end();

    const fileName = path.basename(fullPath);
    const filePath = `ssh://${settings.sshUser}@${settings.sshHost}${fullPath}`;
    return { success: true, filePath, content, fileName };
  } catch (err) {
    if (conn) conn.end();
    const needsPassword = !sshKeyExists() && !password;
    return {
      success: false,
      error: err.message || String(err),
      needsPassword,
      filePath: null,
      content: null,
      fileName: null,
    };
  }
});

ipcMain.handle('ssh:copyKey', async (_event, { password, sshHost, sshUser, sshPort }) => {
  try {
    if (!sshKeyExists()) {
      const { generateKeyPairSync } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      });

      const sshDir = path.dirname(SSH_KEY_PATH);
      fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(SSH_KEY_PATH, privateKey, { mode: 0o600 });

      const pubKeyForSsh = pemToOpenSsh(publicKey, `${sshUser}@markalldown`);
      fs.writeFileSync(SSH_PUB_KEY_PATH, pubKeyForSsh, { mode: 0o644 });
    }

    const pubKey = fs.readFileSync(SSH_PUB_KEY_PATH, 'utf-8').trim();

    const conn = await sshConnect({
      host: sshHost,
      port: sshPort || 22,
      username: sshUser,
      password,
    });

    await sshExec(conn, 'mkdir -p ~/.ssh && chmod 700 ~/.ssh');
    await sshExec(
      conn,
      `grep -qxF '${pubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${pubKey}' >> ~/.ssh/authorized_keys`
    );
    await sshExec(conn, 'chmod 600 ~/.ssh/authorized_keys');
    conn.end();

    const settings = loadSettings();
    settings.sshKeyPath = SSH_KEY_PATH;
    saveSettings(settings);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

function pemToOpenSsh(pemPublicKey, comment) {
  const lines = pemPublicKey.split('\n').filter((l) => !l.startsWith('---') && l.trim());
  const derB64 = lines.join('');
  const der = Buffer.from(derB64, 'base64');

  function readASN1Length(buf, offset) {
    let len = buf[offset];
    let bytesRead = 1;
    if (len & 0x80) {
      const numBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | buf[offset + 1 + i];
      }
      bytesRead += numBytes;
    }
    return { len, bytesRead };
  }

  function readASN1Integer(buf, offset) {
    if (buf[offset] !== 0x02) throw new Error('Expected INTEGER');
    offset++;
    const { len, bytesRead } = readASN1Length(buf, offset);
    offset += bytesRead;
    const data = buf.slice(offset, offset + len);
    return { data, nextOffset: offset + len };
  }

  let offset = 0;
  if (der[offset] !== 0x30) throw new Error('Expected SEQUENCE');
  offset++;
  const seq = readASN1Length(der, offset);
  offset += seq.bytesRead;

  const modulus = readASN1Integer(der, offset);
  offset = modulus.nextOffset;
  const exponent = readASN1Integer(der, offset);

  let modBuf = modulus.data;
  if (modBuf[0] === 0) modBuf = modBuf.slice(1);
  modBuf = Buffer.concat([Buffer.from([0x00]), modBuf]);

  const expBuf = exponent.data;

  function encodeSshString(buf) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(buf.length);
    return Buffer.concat([lenBuf, buf]);
  }

  const keyType = Buffer.from('ssh-rsa');
  const blob = Buffer.concat([
    encodeSshString(keyType),
    encodeSshString(expBuf),
    encodeSshString(modBuf),
  ]);

  return `ssh-rsa ${blob.toString('base64')} ${comment}\n`;
}

// ── Pages mode IPC ──────────────────────────────────────────────────────────

ipcMain.handle('pages:loadPage', async (_event, { pagePath, password }) => {
  const settings = loadSettings();
  const pg = settings.pages || {};
  const source = pg.source || 'local';
  const pagesRoot = ((source === 'ssh' ? pg.remotePath : pg.localPath) || '').replace(/\/+$/, '');
  if (!pagesRoot) return { success: false, error: 'no-config' };

  let conn = null,
    sftp = null;
  try {
    if (source === 'ssh') {
      const authConfig = getSshAuthConfig(settings, password);
      try {
        conn = await sshConnect(authConfig);
        sftp = await sftpFromConn(conn);
      } catch (err) {
        const needsPassword = !sshKeyExists() && !password;
        return { success: false, error: err.message, needsPassword };
      }
    }

    const normalized = normalizePagePath(pagePath);
    const candidates = [
      pagesRoot + '/' + normalized + '.md',
      pagesRoot + '/' + normalized + '/index.md',
    ];
    let resolvedPath = null,
      rawMarkdown = null;
    for (const c of candidates) {
      if (await pageFileExists(sftp, c)) {
        resolvedPath = c;
        rawMarkdown = await readPageFile(sftp, c);
        break;
      }
    }
    if (!rawMarkdown) return { success: false, error: `Page not found: ${pagePath}` };

    const { data: frontMatter, content: mdContent } = parseFrontMatter(rawMarkdown);

    // _config.yml (cached per pagesRoot)
    if (!_pagesConfigCache[pagesRoot]) {
      try {
        _pagesConfigCache[pagesRoot] = parseSimpleYaml(
          await readPageFile(sftp, pagesRoot + '/_config.yml')
        );
      } catch (_) {
        _pagesConfigCache[pagesRoot] = {};
      }
    }
    const siteData = _pagesConfigCache[pagesRoot];

    // Resolve {% include %} tags in markdown content
    let processedContent = mdContent;
    const includeRe = /\{%-?\s*include\s+([\w./\-]+)[^%]*-?%\}/g;
    let im;
    while ((im = includeRe.exec(mdContent)) !== null) {
      const iKey = pagesRoot + '/_includes/' + im[1];
      if (_pagesIncludeCache[iKey] === undefined) {
        try {
          _pagesIncludeCache[iKey] = await readPageFile(sftp, iKey);
        } catch (_) {
          _pagesIncludeCache[iKey] = '';
        }
      }
      processedContent = processedContent.replace(im[0], _pagesIncludeCache[iKey]);
    }

    // Layout (cached per path)
    let layoutHtml = null;
    if (frontMatter.layout) {
      const lKey = pagesRoot + '/_layouts/' + frontMatter.layout + '.html';
      if (_pagesLayoutCache[lKey] === undefined) {
        try {
          _pagesLayoutCache[lKey] = await readPageFile(sftp, lKey);
        } catch (_) {
          _pagesLayoutCache[lKey] = null;
        }
      }
      layoutHtml = _pagesLayoutCache[lKey] || null;
    }

    if (conn) conn.end();
    return {
      success: true,
      markdownContent: processedContent,
      frontMatter,
      layoutHtml,
      siteData,
      resolvedPath: resolvedPath.replace(pagesRoot + '/', ''),
    };
  } catch (err) {
    if (conn)
      try {
        conn.end();
      } catch (_) {}
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('pages:listFiles', async (_event, { password } = {}) => {
  const settings = loadSettings();
  const pg = settings.pages || {};
  const source = pg.source || 'local';
  const pagesRoot = ((source === 'ssh' ? pg.remotePath : pg.localPath) || '').replace(/\/+$/, '');
  if (!pagesRoot) return { success: false, error: 'no-config' };

  let conn = null,
    sftp = null;
  try {
    if (source === 'ssh') {
      const authConfig = getSshAuthConfig(settings, password);
      try {
        conn = await sshConnect(authConfig);
        sftp = await sftpFromConn(conn);
      } catch (err) {
        return { success: false, error: err.message, needsPassword: !sshKeyExists() && !password };
      }
    }

    const files = [];

    async function walkDir(dirPath, depth) {
      if (depth > 3) return;
      const entries = sftp
        ? await sftpReaddirAll(sftp, dirPath)
        : (await fs.promises.readdir(dirPath, { withFileTypes: true })).map((e) => ({
            name: e.name,
            path: dirPath + '/' + e.name,
            isDirectory: e.isDirectory(),
          }));

      for (const entry of entries) {
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
        if (entry.isDirectory) {
          await walkDir(entry.path, depth + 1);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
          const relPath = entry.path.replace(pagesRoot + '/', '');
          try {
            const raw = await readPageFile(sftp, entry.path);
            const { data: fm, content } = parseFrontMatter(raw);
            // Title: front matter > first heading > filename
            let title = fm.title;
            if (!title) {
              const hm = content.match(/^#{1,2}\s+(.+)$/m);
              title = hm ? hm[1].trim() : entry.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            }
            // Date: front matter > local file mtime
            let date = fm.date || fm.Date || null;
            if (!date && !sftp) {
              try {
                const st = await fs.promises.stat(entry.path);
                date = st.mtime.toISOString().slice(0, 10);
              } catch (_) {}
            }
            // Excerpt: first non-heading, non-empty paragraph line
            const excerptLine = content
              .split('\n')
              .map((l) => l.trim())
              .find((l) => l && !l.startsWith('#') && !l.startsWith('```'));
            const excerpt = excerptLine ? excerptLine.replace(/[*_`\[\]]/g, '').slice(0, 160) : '';
            const pathNoExt = relPath.replace(/\.[^.]+$/, '');
            const folder = relPath.includes('/') ? relPath.split('/')[0] : '';
            files.push({ path: pathNoExt, title, date, excerpt, folder });
          } catch (_) {}
        }
      }
    }

    await walkDir(pagesRoot, 0);
    if (conn) conn.end();

    // Sort: dated newest-first, then undated alphabetically
    files.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.title.localeCompare(b.title);
    });

    return { success: true, files, rootName: path.basename(pagesRoot) };
  } catch (err) {
    if (conn)
      try {
        conn.end();
      } catch (_) {}
    return { success: false, error: err.message || String(err) };
  }
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
