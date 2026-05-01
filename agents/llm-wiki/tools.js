'use strict';

const path = require('path');

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

function ensureDirPath(remotePath) {
  return normalizeRemotePath(remotePath || '/');
}

function joinRemote(...parts) {
  return normalizeRemotePath(path.posix.join(...parts.filter(Boolean)));
}

function isPathWithin(rootPath, targetPath) {
  const root = ensureDirPath(rootPath);
  const target = normalizeRemotePath(targetPath);
  return (
    target === root || target.startsWith(`${root === '/' ? '' : root}/`)
  );
}

function relativeTo(rootPath, absPath) {
  const root = ensureDirPath(rootPath);
  const abs = normalizeRemotePath(absPath);
  if (!isPathWithin(root, abs)) return null;
  if (abs === root) return '';
  const prefix = root === '/' ? '' : root;
  return abs.slice(prefix.length + 1);
}

// resolvePath — accepts either an absolute wiki path ("/wiki/pages/x.md") or a
// wiki-relative path ("pages/x.md"). Always returns an absolute path.
// Rejects any path that escapes wikiRoot, and (unless allowRaw) any path under
// raw/.
function resolvePath(wikiRoot, argPath, { allowRaw = false } = {}) {
  if (typeof argPath !== 'string' || !argPath.trim()) {
    return { error: 'path must be a non-empty string' };
  }
  if (argPath.includes('..')) {
    return { error: 'path must not contain ".."' };
  }
  const abs = argPath.startsWith('/')
    ? normalizeRemotePath(argPath)
    : joinRemote(wikiRoot, argPath);
  if (!isPathWithin(wikiRoot, abs)) {
    return { error: `path "${argPath}" escapes wikiRoot "${wikiRoot}"` };
  }
  if (!allowRaw) {
    const rel = relativeTo(wikiRoot, abs) || '';
    if (rel === 'raw' || rel.startsWith('raw/')) {
      return { error: 'writes under raw/ are not allowed' };
    }
  }
  return { abs, rel: relativeTo(wikiRoot, abs) || '' };
}

async function readFileOrEmpty(client, absPath) {
  try {
    return String(await client.getFileContents(absPath, { format: 'text' }));
  } catch (err) {
    const msg = String(err?.message || '');
    if (/404|not ?found/i.test(msg)) return null;
    throw err;
  }
}

async function ensureParentDir(client, absPath) {
  const dir = path.posix.dirname(absPath);
  if (!dir || dir === '/') return;
  try {
    await client.createDirectory(dir, { recursive: true });
  } catch (err) {
    const msg = String(err?.message || '');
    // WebDAV returns 405 when the directory already exists on some servers.
    if (!/405|409|already ?exists|method ?not ?allowed/i.test(msg)) throw err;
  }
}

// ─── Tool schemas (OpenAI function-call shape) ──────────────────────────────

const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'list_wiki',
      description:
        'List markdown files under the wiki. Pass a wiki-relative subdir (e.g. "pages/concepts"). Returns up to 200 paths.',
      parameters: {
        type: 'object',
        properties: {
          subdir: { type: 'string', description: 'Wiki-relative directory. Omit for the whole wiki.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_page',
      description: 'Read a wiki page or raw source by path. Returns content up to 32KB.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Wiki-relative or absolute path under wikiRoot.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_index',
      description: 'Read the wiki catalog (index.md). Returns an empty string if the index does not yet exist.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_wiki',
      description:
        'Case-insensitive substring search across all markdown files under the wiki. Returns up to `limit` hits (default 20). Skips `raw/` unless includeRaw is true.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
          includeRaw: { type: 'boolean' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_page',
      description:
        'Create or overwrite a wiki page. Path must be under wikiRoot and not under raw/. Parent directories are created as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_page',
      description:
        'Replace the first occurrence of oldText with newText in a wiki page. Fails if the page does not exist, oldText is not found, or oldText appears more than once (disambiguate with more context).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          oldText: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['path', 'oldText', 'newText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_log',
      description:
        'Append one line to log.md. Wrap long entries in a single line (no newlines) so the log stays grep-friendly.',
      parameters: {
        type: 'object',
        properties: { line: { type: 'string' } },
        required: ['line'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_index',
      description: 'Rewrite index.md with the provided full markdown content.',
      parameters: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'done',
      description:
        'Terminate the loop. Provide a markdown summary (shown to the user) and a list of wiki-relative paths you touched.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          touched: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary'],
      },
    },
  },
];

// ─── Tool implementations ──────────────────────────────────────────────────

async function execList({ client, wikiRoot }, args) {
  const sub = args?.subdir ? String(args.subdir) : '';
  const base = sub ? joinRemote(wikiRoot, sub) : ensureDirPath(wikiRoot);
  if (!isPathWithin(wikiRoot, base)) {
    return { error: 'subdir escapes wikiRoot' };
  }

  const queue = [base];
  const paths = [];
  const LIMIT = 200;

  while (queue.length && paths.length < LIMIT) {
    const dir = queue.shift();
    let items;
    try {
      items = await client.getDirectoryContents(dir);
    } catch (err) {
      const msg = String(err?.message || '');
      if (/404|not ?found/i.test(msg)) continue;
      throw err;
    }
    for (const item of items || []) {
      const abs = normalizeRemotePath(item.filename || item.href || item.basename || '');
      if (!isPathWithin(wikiRoot, abs)) continue;
      if (item.type === 'directory') {
        queue.push(abs);
        continue;
      }
      if (!abs.toLowerCase().endsWith('.md')) continue;
      paths.push(relativeTo(wikiRoot, abs) || abs);
      if (paths.length >= LIMIT) break;
    }
  }

  paths.sort();
  return { paths, truncated: paths.length >= LIMIT };
}

async function execReadPage({ client, wikiRoot }, args) {
  const resolved = resolvePath(wikiRoot, args?.path, { allowRaw: true });
  if (resolved.error) return { error: resolved.error };
  const content = await readFileOrEmpty(client, resolved.abs);
  if (content === null) {
    return { exists: false, content: '' };
  }
  const MAX = 32 * 1024;
  if (content.length > MAX) {
    return {
      exists: true,
      content: content.slice(0, MAX),
      truncated: true,
      originalLength: content.length,
    };
  }
  return { exists: true, content };
}

async function execReadIndex({ client, wikiRoot }) {
  const abs = joinRemote(wikiRoot, 'index.md');
  const content = await readFileOrEmpty(client, abs);
  return { content: content || '' };
}

async function execSearchWiki({ client, wikiRoot }, args) {
  const query = String(args?.query || '').trim().toLowerCase();
  if (!query) return { error: 'query is required' };
  const limit = Math.max(1, Math.min(100, Number(args?.limit) || 20));
  const includeRaw = Boolean(args?.includeRaw);

  const listRes = await execList({ client, wikiRoot }, {});
  if (listRes.error) return listRes;

  const hits = [];
  for (const relPath of listRes.paths) {
    if (!includeRaw && (relPath === 'raw' || relPath.startsWith('raw/'))) continue;
    const abs = joinRemote(wikiRoot, relPath);
    const content = await readFileOrEmpty(client, abs);
    if (content === null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].toLowerCase().includes(query)) {
        hits.push({
          path: relPath,
          line: i + 1,
          snippet: lines[i].slice(0, 200),
        });
        if (hits.length >= limit) break;
      }
    }
    if (hits.length >= limit) break;
  }
  return { hits, truncated: hits.length >= limit };
}

async function execWritePage({ client, wikiRoot }, args) {
  const resolved = resolvePath(wikiRoot, args?.path, { allowRaw: false });
  if (resolved.error) return { error: resolved.error };
  if (typeof args?.content !== 'string') {
    return { error: 'content must be a string' };
  }
  await ensureParentDir(client, resolved.abs);
  await client.putFileContents(resolved.abs, args.content, { overwrite: true });
  return { ok: true, path: resolved.rel };
}

async function execEditPage({ client, wikiRoot }, args) {
  const resolved = resolvePath(wikiRoot, args?.path, { allowRaw: false });
  if (resolved.error) return { error: resolved.error };
  if (typeof args?.oldText !== 'string' || !args.oldText.length) {
    return { error: 'oldText is required' };
  }
  if (typeof args?.newText !== 'string') {
    return { error: 'newText must be a string' };
  }
  const existing = await readFileOrEmpty(client, resolved.abs);
  if (existing === null) {
    return { error: `page does not exist: ${resolved.rel}` };
  }
  const firstIdx = existing.indexOf(args.oldText);
  if (firstIdx === -1) {
    return { error: 'oldText not found in page' };
  }
  const secondIdx = existing.indexOf(args.oldText, firstIdx + args.oldText.length);
  if (secondIdx !== -1) {
    return {
      error: 'oldText appears more than once; add more surrounding context so the match is unique',
    };
  }
  const updated =
    existing.slice(0, firstIdx) + args.newText + existing.slice(firstIdx + args.oldText.length);
  await client.putFileContents(resolved.abs, updated, { overwrite: true });
  return { ok: true, path: resolved.rel };
}

async function execAppendLog({ client, wikiRoot }, args) {
  const line = String(args?.line || '').replace(/\r?\n/g, ' ').trim();
  if (!line) return { error: 'line is required' };
  const abs = joinRemote(wikiRoot, 'log.md');
  const existing = (await readFileOrEmpty(client, abs)) || '# Log\n\n';
  const updated = `${existing.replace(/\s*$/, '')}\n${line}\n`;
  await ensureParentDir(client, abs);
  await client.putFileContents(abs, updated, { overwrite: true });
  return { ok: true };
}

async function execUpdateIndex({ client, wikiRoot }, args) {
  if (typeof args?.content !== 'string') {
    return { error: 'content must be a string' };
  }
  const abs = joinRemote(wikiRoot, 'index.md');
  await ensureParentDir(client, abs);
  await client.putFileContents(abs, args.content, { overwrite: true });
  return { ok: true };
}

const EXECUTORS = {
  list_wiki: execList,
  read_page: execReadPage,
  read_index: execReadIndex,
  search_wiki: execSearchWiki,
  write_page: execWritePage,
  edit_page: execEditPage,
  append_log: execAppendLog,
  update_index: execUpdateIndex,
};

async function executeTool(ctx, name, args) {
  if (name === 'done') {
    return { __done: true, summary: String(args?.summary || ''), touched: Array.isArray(args?.touched) ? args.touched.map(String) : [] };
  }
  const fn = EXECUTORS[name];
  if (!fn) return { error: `unknown tool: ${name}` };
  try {
    return await fn(ctx, args || {});
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

module.exports = {
  TOOL_SCHEMAS,
  executeTool,
  // exported for worker.js:
  normalizeRemotePath,
  ensureDirPath,
  joinRemote,
  isPathWithin,
  relativeTo,
  resolvePath,
  readFileOrEmpty,
  ensureParentDir,
};
