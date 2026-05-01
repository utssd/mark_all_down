'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Loader: discovers agent plugins in an agents directory.
 *
 * An agent is a subfolder of `agents/` that:
 *   - contains an `AGENT.md` file with YAML frontmatter
 *   - whose folder name does NOT start with `_` (those are framework folders)
 *
 * Frontmatter format (see docs in plan and agents/README.md):
 *   ---
 *   name: my-agent
 *   title: My Agent
 *   description: …
 *   execution: local | cloud | hybrid
 *   entry: { worker: worker.js, ui: { html, css, js } }
 *   capabilities: { webdav: false|"read"|"write", messaging: bool }
 *   requires: { llm: { provider }, webdav: bool }
 *   cloud: { run, message, cancel, adapter }
 *   params: [ { name, type, label, default } ]
 *   ---
 *   <markdown body>
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function scanSync(agentsDir) {
  let entries;
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const agents = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    if (entry.name.startsWith('.')) continue;

    const dir = path.join(agentsDir, entry.name);
    const manifestPath = path.join(dir, 'AGENT.md');
    let raw;
    try {
      raw = fs.readFileSync(manifestPath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      console.warn(`[agents loader] Failed to read ${manifestPath}:`, err.message);
      continue;
    }

    let parsed;
    try {
      parsed = parseAgentMd(raw);
    } catch (err) {
      console.warn(`[agents loader] Failed to parse ${manifestPath}:`, err.message);
      continue;
    }

    const manifest = parsed.frontmatter;
    if (!manifest || !manifest.name) {
      console.warn(`[agents loader] ${manifestPath} has no name in frontmatter — skipping.`);
      continue;
    }

    const validation = validateManifest(manifest, dir);
    if (validation.error) {
      console.warn(`[agents loader] ${manifestPath}: ${validation.error}`);
      continue;
    }

    agents.push({
      id: manifest.name,
      title: manifest.title || titleCase(manifest.name),
      description: manifest.description || '',
      manifest,
      dir,
      body: parsed.body,
    });
  }

  return agents;
}

function parseAgentMd(text) {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    return { frontmatter: null, body: text };
  }
  const [, yaml, body] = match;
  return { frontmatter: parseYaml(yaml), body: body.trim() };
}

// Minimal YAML parser covering the subset used in AGENT.md:
//  - string/number/boolean scalars
//  - nested maps via indentation
//  - block sequences  ("- foo" or "- { a: 1 }")
//  - inline flow maps ({ a: 1, b: "x" })
//  - inline flow seqs ([1, 2, 3])
//  - quoted strings ("…" or '…')
// Does NOT support: multi-line flow, anchors, merges, YAML tags, document streams.
function parseYaml(src) {
  const lines = src.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).filter((l) => l.trim() !== '');
  const { value } = parseBlock(lines, 0, 0);
  return value;
}

function parseBlock(lines, startIdx, baseIndent) {
  const root = {};
  let rootIsList = null; // null until decided, then true/false
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    const indent = line.match(/^ */)[0].length;
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      // Shouldn't normally happen — caller consumed nested block
      i++;
      continue;
    }
    const content = line.slice(indent);

    if (content.startsWith('- ')) {
      if (rootIsList === null) rootIsList = true;
      if (!rootIsList) throw new Error(`YAML: mixed map and list at indent ${indent}`);
      if (!Array.isArray(root._list)) root._list = [];
      const item = content.slice(2);
      // Inline flow map/scalar
      if (item.startsWith('{') || item.startsWith('[') || !/^[\w$-]+\s*:/.test(item)) {
        root._list.push(parseScalarOrFlow(item));
        i++;
      } else {
        // "- key: value" block → start a sub-map at this indent
        // Treat the remainder as a block map that starts on this same line.
        const nested = {};
        const { key, value, hasMore } = parseMapLine(item);
        nested[key] = value;
        i++;
        if (hasMore) {
          const { value: more, nextIdx } = parseBlock(lines, i, indent + 2);
          Object.assign(nested, more);
          i = nextIdx;
        }
        root._list.push(nested);
      }
      continue;
    }

    if (rootIsList === true) break;
    rootIsList = false;

    const { key, value, hasMore } = parseMapLine(content);
    if (hasMore) {
      const { value: nested, nextIdx } = parseBlock(lines, i + 1, nextIndent(lines, i + 1, indent));
      root[key] = nested;
      i = nextIdx;
    } else {
      root[key] = value;
      i++;
    }
  }
  if (rootIsList) return { value: root._list, nextIdx: i };
  return { value: root, nextIdx: i };
}

function nextIndent(lines, idx, fallback) {
  if (idx >= lines.length) return fallback + 2;
  const line = lines[idx];
  return line.match(/^ */)[0].length;
}

function parseMapLine(content) {
  const colonIdx = findUnquotedColon(content);
  if (colonIdx === -1) throw new Error(`YAML: expected "key: value" but got "${content}"`);
  const key = content.slice(0, colonIdx).trim();
  const rest = content.slice(colonIdx + 1).trim();
  if (rest === '') return { key, value: {}, hasMore: true };
  return { key, value: parseScalarOrFlow(rest), hasMore: false };
}

function findUnquotedColon(s) {
  let inStr = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === ':') {
      // Only count as a mapping colon if followed by whitespace or end-of-line
      const next = s[i + 1];
      if (next === undefined || next === ' ' || next === '\t') return i;
    }
  }
  return -1;
}

function parseScalarOrFlow(s) {
  const t = s.trim();
  if (t === '') return '';
  if (t === 'null' || t === '~') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return unquote(t);
  }
  if (t.startsWith('{')) return parseFlowMap(t);
  if (t.startsWith('[')) return parseFlowSeq(t);
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function unquote(s) {
  const quote = s[0];
  const inner = s.slice(1, -1);
  if (quote === "'") return inner.replaceAll("''", "'");
  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function parseFlowMap(s) {
  const inner = s.slice(1, -1).trim();
  if (inner === '') return {};
  const parts = splitFlow(inner);
  const out = {};
  for (const p of parts) {
    const colon = findUnquotedColon(p);
    if (colon === -1) continue;
    const key = p.slice(0, colon).trim();
    const val = p.slice(colon + 1).trim();
    out[key] = parseScalarOrFlow(val);
  }
  return out;
}

function parseFlowSeq(s) {
  const inner = s.slice(1, -1).trim();
  if (inner === '') return [];
  return splitFlow(inner).map(parseScalarOrFlow);
}

function splitFlow(s) {
  const parts = [];
  let depth = 0;
  let inStr = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts.filter((p) => p !== '');
}

function titleCase(slug) {
  return slug
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function validateManifest(manifest, dir) {
  const execution = manifest.execution || 'local';
  if (execution !== 'local' && execution !== 'cloud' && execution !== 'hybrid') {
    return { error: `invalid execution "${execution}"` };
  }
  const needsWorker = execution === 'local' || execution === 'hybrid';
  if (needsWorker) {
    const workerPath = manifest.entry?.worker;
    if (!workerPath) return { error: 'entry.worker is required for local/hybrid execution' };
    const abs = path.join(dir, workerPath);
    if (!fs.existsSync(abs)) return { error: `entry.worker "${workerPath}" not found` };
  }
  const needsCloud = execution === 'cloud' || execution === 'hybrid';
  if (needsCloud) {
    if (!manifest.cloud?.run) {
      return { error: 'cloud.run is required for cloud/hybrid execution' };
    }
  }
  const uiHtml = manifest.entry?.ui?.html;
  if (uiHtml) {
    const abs = path.join(dir, uiHtml);
    if (!fs.existsSync(abs)) return { error: `entry.ui.html "${uiHtml}" not found` };
  }
  return { error: null };
}

// ── Live-reload watcher ─────────────────────────────────────────────────────

function watch(agentsDir, { onAdd, onUpdate, onRemove }, debounceMs = 150) {
  const seen = new Map(); // name → agent descriptor
  for (const a of scanSync(agentsDir)) seen.set(a.id, a);

  let timer = null;
  const reconcile = () => {
    timer = null;
    const current = new Map();
    for (const a of scanSync(agentsDir)) current.set(a.id, a);

    // Additions + updates
    for (const [id, agent] of current) {
      const prev = seen.get(id);
      if (!prev) onAdd?.(agent);
      else if (manifestDigest(prev) !== manifestDigest(agent)) onUpdate?.(agent);
    }
    // Removals
    for (const id of seen.keys()) {
      if (!current.has(id)) onRemove?.(id);
    }
    seen.clear();
    for (const [id, a] of current) seen.set(id, a);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(reconcile, debounceMs);
  };

  let watcher;
  try {
    watcher = fs.watch(agentsDir, { recursive: true }, schedule);
  } catch (err) {
    // Recursive watch isn't supported on all platforms; fall back to non-recursive
    // plus per-subfolder watches. Keeping the simple recursive path for now — on
    // Linux it works; if it throws we just skip live reload.
    console.warn('[agents loader] fs.watch(recursive) failed:', err.message);
    return { close() {} };
  }

  return {
    close() {
      if (timer) clearTimeout(timer);
      try { watcher.close(); } catch (_) {}
    },
  };
}

function manifestDigest(agent) {
  // Cheap fingerprint of user-visible fields so edits to AGENT.md surface as updates.
  const m = agent.manifest;
  return JSON.stringify([
    agent.id, agent.title, agent.description,
    m.execution, m.entry, m.capabilities, m.requires, m.cloud, m.params,
  ]);
}

module.exports = { scanSync, watch, parseAgentMd };
