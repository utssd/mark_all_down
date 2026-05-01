'use strict';

const fs = require('fs');
const path = require('path');
const { createClient: createWebdavClient } = require('../../vendors/webdav');
const fetch = globalThis.fetch;

const {
  TOOL_SCHEMAS,
  executeTool,
  joinRemote,
  ensureDirPath,
  isPathWithin,
  resolvePath,
  readFileOrEmpty,
  ensureParentDir,
} = require('./tools.js');

const SCHEMA_MD = fs.readFileSync(path.join(__dirname, 'prompts', 'schema.md'), 'utf8');
const INGEST_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'ingest.md'), 'utf8');
const QUERY_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'query.md'), 'utf8');
const LINT_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'lint.md'), 'utf8');

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Utilities ──────────────────────────────────────────────────────────────

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('LLM Wiki run cancelled.');
    err.name = 'AbortError';
    throw err;
  }
}

function createClient(settings) {
  const { url, username, password } = settings.webdav || {};
  if (!url) throw new Error('WebDAV is not configured.');
  return createWebdavClient(url, username ? { username, password: password || '' } : {});
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function extractHtmlTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function looksLikeHtml(text) {
  return /<html[\s>]|<!DOCTYPE|<body[\s>]|<head[\s>]/i.test(String(text || '').slice(0, 2000));
}

function looksLikeAnthropicModel(model) {
  const value = String(model || '').toLowerCase();
  return value.includes('claude') || value.includes('anthropic/');
}

function buildSamplingParams({ provider, model, temperature, topP }) {
  const params = {};
  const useSingle = provider === 'anthropic' || looksLikeAnthropicModel(model);
  if (useSingle) {
    if (Number.isFinite(temperature)) params.temperature = temperature;
    else if (Number.isFinite(topP)) params.top_p = topP;
    return params;
  }
  if (Number.isFinite(temperature)) params.temperature = temperature;
  if (Number.isFinite(topP)) params.top_p = topP;
  return params;
}

function clampMaxTokens(maxTokens) {
  const value = Number(maxTokens);
  if (!Number.isFinite(value) || value <= 0) return 16384;
  return Math.min(128000, Math.max(1024, Math.floor(value)));
}

// ─── OpenAI-compatible chat completion with tool calls ──────────────────────

async function chatCompletion(llm, messages, signal, { tools } = {}) {
  const base = String(llm.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (llm.apiKey) headers.Authorization = `Bearer ${llm.apiKey}`;

  const body = {
    model: llm.model,
    messages,
    max_tokens: clampMaxTokens(llm.maxTokens),
    ...buildSamplingParams({
      provider: llm.provider || 'openai',
      model: llm.model,
      temperature: llm.temperature ?? 0.3,
      topP: llm.topP ?? 1.0,
    }),
  };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error?.message || `HTTP ${resp.status}`);
  }
  const choice = data.choices?.[0];
  if (!choice) throw new Error('LLM returned no choices');
  return choice.message || {};
}

// ─── Agent loop ─────────────────────────────────────────────────────────────

async function runAgentLoop({
  llm,
  systemPrompt,
  userMessage,
  toolCtx,
  signal,
  sendProgress,
  maxRounds,
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  const touched = new Set();
  let emptyTurns = 0;
  let doneSummary = null;

  for (let round = 0; round < maxRounds; round += 1) {
    throwIfAborted(signal);
    const message = await chatCompletion(llm, messages, signal, { tools: TOOL_SCHEMAS });
    // Push assistant message verbatim so tool_call_ids line up.
    const assistantMsg = {
      role: 'assistant',
      content: message.content || '',
    };
    if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
      assistantMsg.tool_calls = message.tool_calls;
    }
    messages.push(assistantMsg);

    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!toolCalls.length) {
      // Implicit end-of-loop: LLM emitted a final answer without calling `done`.
      if (!(message.content || '').trim()) {
        emptyTurns += 1;
        if (emptyTurns >= 3) {
          sendProgress('LLM produced three empty turns; aborting loop.', 'warn');
          break;
        }
        // Nudge and continue.
        messages.push({
          role: 'user',
          content: 'Please either call a tool or call `done` with your final summary.',
        });
        continue;
      }
      doneSummary = String(message.content).trim();
      break;
    }
    emptyTurns = 0;

    for (const call of toolCalls) {
      throwIfAborted(signal);
      const name = call.function?.name;
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = { __parseError: call.function?.arguments };
      }

      sendProgress(`tool: ${name}(${summarizeArgs(name, args)})`, 'info');

      const result = await executeTool(toolCtx, name, args);

      if (result && result.__done) {
        doneSummary = result.summary || '';
        for (const p of result.touched || []) touched.add(String(p));
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true }),
        });
        return { summary: doneSummary, touched: [...touched], rounds: round + 1 };
      }

      // Track paths we wrote/edited for the UI.
      if (name === 'write_page' || name === 'edit_page') {
        if (args?.path) touched.add(String(args.path));
      } else if (name === 'update_index') {
        touched.add('index.md');
      } else if (name === 'append_log') {
        touched.add('log.md');
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 32 * 1024),
      });
    }
  }

  if (doneSummary === null) {
    sendProgress(`Max rounds (${maxRounds}) reached without done.`, 'warn');
    return { summary: '(max rounds reached — wiki state may be partial)', touched: [...touched], rounds: maxRounds };
  }
  return { summary: doneSummary, touched: [...touched], rounds: maxRounds };
}

function summarizeArgs(name, args) {
  if (!args) return '';
  switch (name) {
    case 'list_wiki':
      return args.subdir ? `subdir="${args.subdir}"` : '';
    case 'read_page':
    case 'write_page':
    case 'edit_page':
      return `path="${args.path || ''}"`;
    case 'search_wiki':
      return `query="${String(args.query || '').slice(0, 40)}"`;
    case 'append_log':
      return `"${String(args.line || '').slice(0, 60)}"`;
    case 'update_index':
      return `${(args.content || '').length}B`;
    default:
      return '';
  }
}

// ─── Lockfile ───────────────────────────────────────────────────────────────

async function acquireLock(client, wikiRoot, runId) {
  const lockPath = joinRemote(wikiRoot, '.llm-wiki.lock');
  const existing = await readFileOrEmpty(client, lockPath);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      const age = Date.now() - new Date(parsed.startedAt || 0).getTime();
      if (age < LOCK_TTL_MS) {
        throw new Error(
          `wiki is locked by another run (${parsed.runId || 'unknown'}, started ${Math.round(age / 1000)}s ago). Wait for it to finish or delete ${lockPath}.`
        );
      }
    } catch (err) {
      if (err.message?.startsWith('wiki is locked')) throw err;
      // Malformed lock — overwrite.
    }
  }
  await ensureParentDir(client, lockPath);
  await client.putFileContents(
    lockPath,
    JSON.stringify({ runId, startedAt: new Date().toISOString() }),
    { overwrite: true }
  );
  return lockPath;
}

async function releaseLock(client, lockPath) {
  try {
    await client.deleteFile(lockPath);
  } catch {
    // Best-effort — if it's already gone or the server refuses, move on.
  }
}

// ─── Bootstrap: README.md schema + dir structure ────────────────────────────

async function ensureWikiBootstrap(client, wikiRoot, sendProgress) {
  const dirs = ['raw', 'pages', 'pages/entities', 'pages/concepts', 'pages/sources', 'pages/answers', 'assets'];
  for (const d of dirs) {
    const abs = joinRemote(wikiRoot, d);
    try {
      await client.createDirectory(abs, { recursive: true });
    } catch (err) {
      const msg = String(err?.message || '');
      if (!/405|409|already ?exists|method ?not ?allowed/i.test(msg)) {
        sendProgress(`Could not ensure ${d}/: ${msg}`, 'warn');
      }
    }
  }

  const readmePath = joinRemote(wikiRoot, 'README.md');
  const existing = await readFileOrEmpty(client, readmePath);
  if (existing === null) {
    sendProgress('Seeding wiki README.md with the default schema.', 'info');
    await client.putFileContents(readmePath, SCHEMA_MD, { overwrite: true });
  }
}

async function loadSchema(client, wikiRoot) {
  // Prefer the user-editable WebDAV copy over the bundled one.
  const readmePath = joinRemote(wikiRoot, 'README.md');
  const existing = await readFileOrEmpty(client, readmePath);
  return existing || SCHEMA_MD;
}

// ─── Source ingest: copy into raw/ ──────────────────────────────────────────

async function ingestSource({ client, wikiRoot, source, signal, sendProgress }) {
  throwIfAborted(signal);

  let content = '';
  let title = '';
  let origin = '';

  if (source?.kind === 'url') {
    const url = String(source.url || '').trim();
    if (!url) throw new Error('URL is empty.');
    origin = url;
    sendProgress(`Fetching ${url}…`);
    const resp = await fetch(url, { signal, redirect: 'follow' });
    if (!resp.ok) throw new Error(`Fetch failed: HTTP ${resp.status}`);
    const ct = resp.headers.get('content-type') || '';
    if (/application\/pdf|^image\//i.test(ct)) {
      throw new Error(`Unsupported content-type "${ct}". Convert to markdown first.`);
    }
    content = await resp.text();
    if (looksLikeHtml(content) || /html/i.test(ct)) {
      title = extractHtmlTitle(content);
    }
    if (!title) {
      try {
        const u = new URL(url);
        title = `${u.hostname}${u.pathname}`.replace(/\/$/, '') || u.hostname;
      } catch {
        title = 'web-source';
      }
    }
  } else if (source?.kind === 'webdavPath') {
    const p = String(source.path || '').trim();
    if (!p) throw new Error('WebDAV path is empty.');
    origin = p;
    sendProgress(`Reading ${p}…`);
    const raw = await readFileOrEmpty(client, p);
    if (raw === null) throw new Error(`WebDAV file not found: ${p}`);
    content = raw;
    const base = path.posix.basename(p).replace(/\.[^.]+$/, '');
    title = base || p;
  } else {
    throw new Error(`Unknown source kind: ${source?.kind}`);
  }

  const baseSlug = slugify(title);
  const datePrefix = todayStamp();
  let rawRelPath = `raw/${datePrefix}-${baseSlug}.md`;
  let rawAbs = joinRemote(wikiRoot, rawRelPath);

  // Avoid collisions: if a file already exists with this name, suffix with -2, -3…
  let suffix = 2;
  while ((await readFileOrEmpty(client, rawAbs)) !== null) {
    rawRelPath = `raw/${datePrefix}-${baseSlug}-${suffix}.md`;
    rawAbs = joinRemote(wikiRoot, rawRelPath);
    suffix += 1;
    if (suffix > 20) throw new Error('Too many slug collisions under raw/ today.');
  }

  // Write a small header above the raw content so the LLM knows where it came from.
  const header = `<!-- LLM Wiki raw source\norigin: ${origin}\ningested: ${new Date().toISOString()}\n-->\n\n`;
  await ensureParentDir(client, rawAbs);
  await client.putFileContents(rawAbs, header + content, { overwrite: true });
  sendProgress(`Source copied to ${rawRelPath}`, 'info');

  return { rawRelPath, origin, title, contentLength: content.length };
}

function parseSource(params) {
  const kind = String(params.sourceKind || '').trim();
  if (kind === 'url') return { kind: 'url', url: params.sourceUrl };
  if (kind === 'webdavPath' || kind === 'pages' || kind === 'webdav') {
    return { kind: 'webdavPath', path: params.sourcePath };
  }
  throw new Error('Pick a source: current Pages file, URL, or WebDAV path.');
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function runLlmWiki({ runId, agentId, params = {}, signal, sendProgress }) {
  const settings = params.settings || {};
  const llm = settings.llm || {};
  if (llm.provider && llm.provider !== 'openai') {
    throw new Error('LLM Wiki requires an OpenAI-compatible provider that supports tool calls.');
  }
  if (!llm.model) {
    throw new Error('Set an OpenAI-compatible model in Settings → LLM (or per-agent override) before running LLM Wiki.');
  }

  const wikiRoot = ensureDirPath(params.wikiRoot || '/wiki/');
  const maxRounds = Math.max(5, Math.min(200, Number(params.maxRounds) || 40));
  const op = String(params.op || 'ingest');

  const client = createClient(settings);

  sendProgress(`LLM Wiki · ${op} · wikiRoot=${wikiRoot}`, 'info');
  await ensureWikiBootstrap(client, wikiRoot, sendProgress);

  // Schema is loaded for logging purposes; the agent loop always reads the
  // bundled schema plus the op prompt as its system message. If the user has
  // edited `<wikiRoot>/README.md`, surface that by splicing it into the
  // system prompt instead.
  const schema = await loadSchema(client, wikiRoot);
  const lockPath = await acquireLock(client, wikiRoot, runId);

  let result;
  try {
    const runWithSchema = (systemPrompt, userMessage) =>
      runAgentLoop({
        llm,
        systemPrompt,
        userMessage,
        toolCtx: { client, wikiRoot },
        signal,
        sendProgress,
        maxRounds,
      });

    if (op === 'ingest') {
      const source = parseSource(params);
      const { rawRelPath, origin, title } = await ingestSource({
        client, wikiRoot, source, signal, sendProgress,
      });
      const userMessage = [
        'Ingest the following new source into the wiki.',
        `Source path (under wikiRoot): ${rawRelPath}`,
        `Origin: ${origin}`,
        `Title: ${title}`,
        '',
        'Start by calling `read_index` to see what pages exist, then `read_page` on the raw source. Then update or create entity/concept pages, write a source summary under pages/sources/, update index.md, append one log line, and call `done`.',
      ].join('\n');
      result = await runWithSchema(`${schema}\n\n---\n\n${INGEST_PROMPT}`, userMessage);
    } else if (op === 'query') {
      const question = String(params.question || '').trim();
      if (!question) throw new Error('Query: question is empty.');
      const fileAnswer = Boolean(params.fileAnswers);
      const userMessage = [
        `Answer this question from the wiki: "${question}"`,
        fileAnswer
          ? 'After writing your answer, file it back to pages/answers/<date>-<slug>.md via `write_page`, then update_index to include it.'
          : 'Do not file the answer back — just return it via `done`.',
      ].join('\n\n');
      result = await runWithSchema(`${schema}\n\n---\n\n${QUERY_PROMPT}`, userMessage);
    } else if (op === 'lint') {
      const userMessage =
        'Lint the wiki. Produce a markdown report in the `done.summary` field. Auto-fix only unambiguous issues via `edit_page` or `update_index`.';
      result = await runWithSchema(`${schema}\n\n---\n\n${LINT_PROMPT}`, userMessage);
    } else {
      throw new Error(`Unknown op: ${op}`);
    }
  } finally {
    await releaseLock(client, lockPath);
  }

  sendProgress(`done in ${result.rounds} round(s)`, 'done');

  const markdown = renderOutput({ summary: result.summary });
  return {
    markdown,
    meta: {
      op,
      rounds: result.rounds,
      touched: Array.isArray(result.touched) ? result.touched : [],
      wikiRoot,
    },
  };
}

// ─── Output rendering ───────────────────────────────────────────────────────
//
// The worker now returns *just* the LLM's summary body as `markdown`, and
// a structured `meta` sibling object. The Tier-2 ui.js renderer (see
// agents/llm-wiki/ui.js) builds the result-header card and the touched-
// page chip grid from `meta` — this function no longer emits a header,
// horizontal rule, or bulleted list of touched pages.

function renderOutput({ summary }) {
  const body = summary && summary.trim() ? summary.trim() : '_(no summary)_';
  return `${body}\n`;
}

module.exports = { run: runLlmWiki, runLlmWiki };
