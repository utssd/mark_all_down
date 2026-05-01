'use strict';

const fs = require('fs');
const path = require('path');
const { createClient: createWebdavClient } = require('../../vendors/webdav');
const fetch = globalThis.fetch;

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'on-this-day.md'), 'utf8');

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);
const EXCERPT_CHARS = 400;
const MAX_CANDIDATES = 20;
const DEFAULT_LOOKBACKS = '1y,6mo,3mo,1mo,1w';
const DEFAULT_FUZZ_DAYS = 3;

// ─── Utilities ──────────────────────────────────────────────────────────────

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('On This Day cancelled.');
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
      files.push({
        path: remotePath,
        name: basename(remotePath),
        lastmod: item.lastmod || '',
      });
    }
  }
  return files;
}

// ─── Date anchoring ─────────────────────────────────────────────────────────

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;

function parseAnchorDateFromPath(filePath) {
  // 1. filename starts with YYYY-MM-DD
  const name = basename(filePath);
  const filenameMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(name);
  if (filenameMatch) {
    const d = toDate(filenameMatch[1], filenameMatch[2], filenameMatch[3]);
    if (d) return d;
  }
  // 2. path segment like /YYYY/MM/DD/ or /YYYY-MM-DD/
  const parts = filePath.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const segMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parts[i]);
    if (segMatch) {
      const d = toDate(segMatch[1], segMatch[2], segMatch[3]);
      if (d) return d;
    }
    if (
      i + 2 < parts.length
      && /^\d{4}$/.test(parts[i])
      && /^\d{2}$/.test(parts[i + 1])
      && /^\d{2}$/.test(parts[i + 2])
    ) {
      const d = toDate(parts[i], parts[i + 1], parts[i + 2]);
      if (d) return d;
    }
  }
  return null;
}

function parseAnchorDateFromFrontmatter(content) {
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const dateLine = /^(?:date|created)\s*:\s*["']?([^"'\n#]+?)["']?\s*$/m.exec(fm);
  if (!dateLine) return null;
  const raw = dateLine[1].trim();
  // Try ISO-8601 first, then YYYY-MM-DD extraction.
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) {
    return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
  }
  const m = DATE_RE.exec(raw);
  if (m) return toDate(m[1], m[2], m[3]);
  return null;
}

function toDate(yStr, moStr, dStr) {
  const y = Number(yStr);
  const mo = Number(moStr) - 1;
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

// ─── Lookbacks ──────────────────────────────────────────────────────────────

function parseLookbacks(csv) {
  const tokens = String(csv || DEFAULT_LOOKBACKS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const windows = [];
  for (const tok of tokens) {
    const m = /^(\d+)(d|w|mo|m|y)$/i.exec(tok);
    if (!m) continue;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    windows.push({ label: tok, n, unit });
  }
  return windows;
}

function anchorForWindow(today, win) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (win.unit === 'd') d.setDate(d.getDate() - win.n);
  else if (win.unit === 'w') d.setDate(d.getDate() - 7 * win.n);
  else if (win.unit === 'mo' || win.unit === 'm') d.setMonth(d.getMonth() - win.n);
  else if (win.unit === 'y') d.setFullYear(d.getFullYear() - win.n);
  return d;
}

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── LLM ────────────────────────────────────────────────────────────────────

function looksLikeAnthropicModel(model) {
  const v = String(model || '').toLowerCase();
  return v.includes('claude') || v.includes('anthropic/');
}

function buildSamplingParams({ provider, model, temperature }) {
  const useSingle = provider === 'anthropic' || looksLikeAnthropicModel(model);
  if (useSingle) {
    return Number.isFinite(temperature) ? { temperature } : {};
  }
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

  // OpenAI-compatible
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

exports.run = async ({ params, signal, sendProgress, helpers }) => {
  const settings = params.settings || {};
  if (!settings.webdav?.url) throw new Error('WebDAV is not configured.');
  const llm = settings.llm || {};
  if (!llm.model) throw new Error('LLM model is not configured.');

  const scanRoot = normalizeRemotePath(params.scanRoot || '/');
  const windows = parseLookbacks(params.lookbacks);
  const fuzzDays = Number.isFinite(Number(params.fuzzDays)) ? Math.max(0, Math.floor(Number(params.fuzzDays))) : DEFAULT_FUZZ_DAYS;
  const reflectionsFolder = ensureRemoteDirectoryPath(params.reflectionsFolder || 'reflections/');

  if (windows.length === 0) {
    return {
      markdown: '_No valid lookback windows configured. Use a CSV like `1y,6mo,3mo,1mo,1w`._',
      saveSuggestion: null,
    };
  }

  sendProgress(`Walking vault under ${scanRoot}…`, 'info');
  const client = createClient(settings);
  const files = await walkVault(client, scanRoot, signal, sendProgress);
  sendProgress(`Found ${files.length} markdown file(s).`, 'info');

  const today = new Date();
  const anchorWindows = windows.map((w) => ({ ...w, anchor: anchorForWindow(today, w) }));

  // First pass: quick filename/path anchoring (cheap).
  const fastCandidates = [];
  const needsFrontmatter = [];
  for (const f of files) {
    throwIfAborted(signal);
    const anchor = parseAnchorDateFromPath(f.path);
    if (anchor) {
      const match = matchWindow(anchor, anchorWindows, fuzzDays);
      if (match) fastCandidates.push({ ...f, anchor, matched: match });
      continue;
    }
    needsFrontmatter.push(f);
  }

  // Second pass: read front-matter for files without a path-based anchor.
  // Cap the slow pass to avoid reading entire vaults on big libraries.
  const SLOW_CAP = 200;
  const slowSubset = needsFrontmatter.slice(0, SLOW_CAP);
  if (needsFrontmatter.length > SLOW_CAP) {
    sendProgress(
      `Checking front-matter on ${SLOW_CAP} of ${needsFrontmatter.length} un-anchored files…`,
      'warn',
    );
  } else if (slowSubset.length > 0) {
    sendProgress(`Checking front-matter on ${slowSubset.length} un-anchored file(s)…`, 'info');
  }
  const fmCandidates = [];
  for (const f of slowSubset) {
    throwIfAborted(signal);
    let content = '';
    try {
      content = await client.getFileContents(f.path, { format: 'text' });
    } catch {
      continue;
    }
    const anchor = parseAnchorDateFromFrontmatter(String(content));
    if (!anchor) continue;
    const match = matchWindow(anchor, anchorWindows, fuzzDays);
    if (match) fmCandidates.push({ ...f, anchor, matched: match, _cachedContent: String(content) });
  }

  let candidates = [...fastCandidates, ...fmCandidates];
  sendProgress(`Matched ${candidates.length} candidate(s) across ${windows.length} window(s).`, 'info');

  if (candidates.length === 0) {
    return {
      markdown:
        `_No date-anchored notes matched today's lookbacks (${windows.map((w) => w.label).join(', ')}) with ±${fuzzDays}-day fuzz._\n\n`
        + '_Files qualify if their filename starts with `YYYY-MM-DD`, their path contains a `YYYY/MM/DD/` or `YYYY-MM-DD/` segment, or their front-matter has `date:` / `created:`._',
      saveSuggestion: null,
    };
  }

  // Sort newest-anchor first, cap at MAX_CANDIDATES.
  candidates.sort((a, b) => b.anchor.getTime() - a.anchor.getTime());
  if (candidates.length > MAX_CANDIDATES) {
    sendProgress(`Capping at ${MAX_CANDIDATES} candidates (of ${candidates.length}).`, 'warn');
    candidates = candidates.slice(0, MAX_CANDIDATES);
  }

  // Fetch excerpts for candidates that don't already have content cached.
  sendProgress('Fetching excerpts…', 'info');
  for (const c of candidates) {
    throwIfAborted(signal);
    if (c._cachedContent) {
      c.excerpt = stripFrontmatter(c._cachedContent).slice(0, EXCERPT_CHARS);
      continue;
    }
    try {
      const body = await client.getFileContents(c.path, { format: 'text' });
      c.excerpt = stripFrontmatter(String(body)).slice(0, EXCERPT_CHARS);
    } catch (err) {
      sendProgress(`Skipping ${c.path}: ${err.message || err}`, 'warn');
      c.excerpt = '';
    }
  }
  candidates = candidates.filter((c) => c.excerpt);

  if (candidates.length === 0) {
    return {
      markdown: '_Matched candidates but could not read their content. Check WebDAV connectivity._',
      saveSuggestion: null,
    };
  }

  const userMessage = buildUserMessage(candidates, today);

  sendProgress('Calling LLM…', 'info');
  const reflection = await callLlm(llm, SYSTEM_PROMPT, userMessage, signal);

  // Parse out the SELECTED_PATH: sentinel.
  const sentinelMatch = /SELECTED_PATH:\s*(\S.*)\s*$/m.exec(reflection);
  const chosenPath = sentinelMatch ? sentinelMatch[1].trim() : '';
  const cleaned = reflection.replace(/\n?SELECTED_PATH:\s*.*$/m, '').trim();

  // Side effect: open the chosen note in Pages if we can match it.
  if (helpers?.openWebdavFile && chosenPath) {
    const resolved = candidates.find((c) => c.path === chosenPath)
      || candidates.find((c) => c.path.endsWith(chosenPath))
      || null;
    if (resolved) {
      try {
        await helpers.openWebdavFile(resolved.path);
      } catch (err) {
        sendProgress(`Could not open ${resolved.path}: ${err.message || err}`, 'warn');
      }
    } else {
      sendProgress(`LLM named a path not in candidates: ${chosenPath}`, 'warn');
    }
  }

  const todayStr = fmtDate(today);
  const notePath = `${reflectionsFolder}${todayStr}-on-this-day.md`;
  const content = buildNoteContent(cleaned, chosenPath, todayStr);

  sendProgress('Done.', 'done');
  return {
    markdown: cleaned,
    saveSuggestion: {
      path: notePath,
      content,
      label: `Save to ${notePath}`,
    },
  };
};

function matchWindow(anchor, anchorWindows, fuzzDays) {
  for (const w of anchorWindows) {
    if (daysBetween(anchor, w.anchor) <= fuzzDays) return w.label;
  }
  return null;
}

function buildUserMessage(candidates, today) {
  const header = `Today is ${fmtDate(today)}. Here are ${candidates.length} candidate note(s) from your past that match today's lookback windows. Pick exactly one and write the reflection per your instructions.`;
  const body = candidates
    .map((c, i) => {
      return `### Candidate ${i + 1}\n- Path: ${c.path}\n- Anchor date: ${fmtDate(c.anchor)}\n- Matched window: ${c.matched}\n- Excerpt (first ${EXCERPT_CHARS} chars):\n\n${c.excerpt}`;
    })
    .join('\n\n---\n\n');
  return `${header}\n\n${body}`;
}

function buildNoteContent(reflection, sourcePath, todayStr) {
  const fm = [
    '---',
    `date: ${todayStr}`,
    'agent: on-this-day',
    sourcePath ? `source: ${sourcePath}` : '',
    '---',
    '',
  ]
    .filter((line) => line !== false && line !== null && line !== undefined)
    .join('\n');
  return `${fm}\n${reflection}\n`;
}
