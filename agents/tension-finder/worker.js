'use strict';

const fs = require('fs');
const path = require('path');
const { createClient: createWebdavClient } = require('../../vendors/webdav');
const fetch = globalThis.fetch;

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'tension-finder.md'), 'utf8');

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);
const MAX_BODY_CHARS = 3000;
const DEFAULT_DAYS = 7;
const DEFAULT_MAX_FILES = 10;
const HARD_MAX_FILES = 20;
const HARD_MAX_DAYS = 30;

// ─── Utilities ──────────────────────────────────────────────────────────────

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('Tension Finder cancelled.');
    err.name = 'AbortError';
    throw err;
  }
}

function normalizeRemotePath(remotePath, fallback = '/') {
  let value = String(remotePath || fallback || '/').trim().replace(/\\/g, '/');
  if (!value) value = fallback || '/';
  if (!value.startsWith('/')) value = `/${value}`;
  value = path.posix.normalize(value);
  if (!value.startsWith('/')) value = `/${value}`;
  return value === '/' ? '/' : value.replace(/\/+$/, '');
}

function ensureRemoteDirectoryPath(remotePath) {
  const normalized = normalizeRemotePath(remotePath || '/');
  return normalized === '/' ? '/' : `${normalized}/`;
}

function getFileExtension(remotePath) {
  return path.posix.extname(normalizeRemotePath(remotePath)).toLowerCase();
}

function basename(remotePath) {
  return path.posix.basename(normalizeRemotePath(remotePath));
}

function createClient(settings) {
  const { url, username, password } = settings.webdav || {};
  if (!url) throw new Error('WebDAV is not configured.');
  return createWebdavClient(url, username ? { username, password: password || '' } : {});
}

function stripFrontmatter(content) {
  return String(content || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Walker ─────────────────────────────────────────────────────────────────

async function walkVault(client, scanRoot, signal, sendProgress) {
  const queue = [scanRoot === '/' ? '/' : normalizeRemotePath(scanRoot)];
  const files = [];
  let processedDirs = 0;

  while (queue.length > 0) {
    throwIfAborted(signal);
    const currentDir = queue.shift();
    let items;
    try {
      items = await client.getDirectoryContents(currentDir);
    } catch (err) {
      throw new Error(`Failed to list ${currentDir}: ${err.message || err}`);
    }
    processedDirs += 1;
    if (processedDirs % 20 === 0) {
      sendProgress(`Scanned ${processedDirs} folder(s)…`, 'info');
    }

    for (const item of items || []) {
      throwIfAborted(signal);
      const remotePath = normalizeRemotePath(item.filename || item.href || item.path || item.basename || '/');
      if (item.type === 'directory') {
        queue.push(remotePath);
        continue;
      }
      if (!TEXT_EXTENSIONS.has(getFileExtension(remotePath))) continue;
      const lastmod = item.lastmod ? new Date(item.lastmod) : null;
      files.push({
        path: remotePath,
        name: basename(remotePath),
        lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : null,
      });
    }
  }
  return files;
}

// ─── LLM ────────────────────────────────────────────────────────────────────

function looksLikeAnthropicModel(model) {
  const v = String(model || '').toLowerCase();
  return v.includes('claude') || v.includes('anthropic/');
}

function buildSamplingParams({ provider, model, temperature }) {
  const useSingle = provider === 'anthropic' || looksLikeAnthropicModel(model);
  if (useSingle) return Number.isFinite(temperature) ? { temperature } : {};
  return Number.isFinite(temperature) ? { temperature } : {};
}

async function callLlm(llm, systemPrompt, userMessage, signal) {
  const temperature = Number.isFinite(llm.temperature) ? llm.temperature : 0.4;
  const maxTokens = Number.isFinite(Number(llm.maxTokens)) && Number(llm.maxTokens) > 0
    ? Math.min(8192, Math.max(512, Math.floor(Number(llm.maxTokens))))
    : 2000;

  if (llm.provider === 'anthropic') {
    const base = String(llm.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const isOfficial = /^https?:\/\/api\.anthropic\.com(?:\/|$)/i.test(base);
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (llm.apiKey) {
      headers[isOfficial ? 'x-api-key' : 'Authorization'] = isOfficial ? llm.apiKey : `Bearer ${llm.apiKey}`;
      if (!isOfficial) headers['x-api-key'] = llm.apiKey;
    }
    const resp = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: llm.model,
        max_tokens: maxTokens,
        ...buildSamplingParams({ provider: llm.provider, model: llm.model, temperature }),
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
    return data.content?.[0]?.text ?? '';
  }

  const base = String(llm.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (llm.apiKey) headers.Authorization = `Bearer ${llm.apiKey}`;
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: llm.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      ...buildSamplingParams({ provider: llm.provider, model: llm.model, temperature }),
    }),
    signal,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Main ───────────────────────────────────────────────────────────────────

exports.run = async ({ params, signal, sendProgress }) => {
  const settings = params.settings || {};
  if (!settings.webdav?.url) throw new Error('WebDAV is not configured.');
  const llm = settings.llm || {};
  if (!llm.model) throw new Error('LLM model is not configured.');

  const scanRoot = normalizeRemotePath(params.scanRoot || '/');
  const days = clampInt(params.days, DEFAULT_DAYS, 1, HARD_MAX_DAYS);
  const maxFiles = clampInt(params.maxFiles, DEFAULT_MAX_FILES, 1, HARD_MAX_FILES);
  const reflectionsFolder = ensureRemoteDirectoryPath(params.reflectionsFolder || 'reflections/');

  sendProgress(`Walking vault under ${scanRoot}…`, 'info');
  const client = createClient(settings);
  const files = await walkVault(client, scanRoot, signal, sendProgress);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recent = files
    .filter((f) => f.lastmod && f.lastmod >= cutoff)
    .sort((a, b) => b.lastmod.getTime() - a.lastmod.getTime())
    .slice(0, maxFiles);

  sendProgress(`Found ${recent.length} file(s) modified in the last ${days} day(s).`, 'info');

  if (recent.length < 2) {
    return {
      markdown:
        `_Not enough recent writing to find a tension — need at least 2 files modified in the last ${days} day(s), found ${recent.length}._`,
      saveSuggestion: null,
    };
  }

  sendProgress('Reading file bodies…', 'info');
  const bodies = [];
  for (const f of recent) {
    throwIfAborted(signal);
    try {
      const body = await client.getFileContents(f.path, { format: 'text' });
      const clean = stripFrontmatter(String(body)).trim();
      if (!clean) continue;
      bodies.push({
        path: f.path,
        lastmod: f.lastmod,
        body: clean.slice(0, MAX_BODY_CHARS),
        truncated: clean.length > MAX_BODY_CHARS,
      });
    } catch (err) {
      sendProgress(`Skipping ${f.path}: ${err.message || err}`, 'warn');
    }
  }

  if (bodies.length < 2) {
    return {
      markdown: '_Could not read enough file bodies to find a tension. Check WebDAV connectivity._',
      saveSuggestion: null,
    };
  }

  const userMessage = buildUserMessage(bodies, days);

  sendProgress('Calling LLM…', 'info');
  const reflection = (await callLlm(llm, SYSTEM_PROMPT, userMessage, signal)).trim();

  const today = new Date();
  const todayStr = fmtDate(today);
  const notePath = `${reflectionsFolder}${todayStr}-tension.md`;
  const content = buildNoteContent(reflection, bodies.map((b) => b.path), todayStr);

  sendProgress('Done.', 'done');
  return {
    markdown: reflection,
    saveSuggestion: {
      path: notePath,
      content,
      label: `Save to ${notePath}`,
    },
  };
};

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.max(min, Math.min(max, Math.floor(n)));
  return clamped;
}

function buildUserMessage(bodies, days) {
  const header = `Here are the ${bodies.length} most-recently-modified markdown files from the user's vault (last ${days} day(s)). Read all of them, then name one unresolved tension per your instructions.`;
  const body = bodies
    .map((b) => {
      const suffix = b.truncated ? `\n\n_(truncated to first ${MAX_BODY_CHARS} chars)_` : '';
      return `=== ${b.path} ===\n${b.body}${suffix}`;
    })
    .join('\n\n');
  return `${header}\n\n${body}`;
}

function buildNoteContent(reflection, sourcePaths, todayStr) {
  const sourcesYaml = sourcePaths.map((p) => `  - ${p}`).join('\n');
  const fm = `---\ndate: ${todayStr}\nagent: tension-finder\nsources:\n${sourcesYaml}\n---\n`;
  return `${fm}\n${reflection}\n`;
}
