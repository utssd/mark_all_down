'use strict';

const path = require('path');
const { scanSync } = require('./loader.js');

// Scan agents once at worker boot. (The main process re-forks the worker when
// the plugin set changes, so we don't need to re-scan here.)
const AGENTS_DIR = path.join(__dirname, '..');
const _agents = new Map(); // agentId → { manifest, dir, module }
for (const a of scanSync(AGENTS_DIR)) {
  _agents.set(a.id, { manifest: a.manifest, dir: a.dir, module: null });
}

// runId → AbortController
const abortControllers = new Map();

// Pending WebDAV save requests (reqId → { resolve, reject })
const _pendingWebdavSaves = new Map();
let _webdavSaveSeq = 0;

// Pending WebDAV read requests (reqId → { resolve, reject })
const _pendingWebdavReads = new Map();
let _webdavReadSeq = 0;

process.on('message', async (msg) => {
  if (msg.type === 'run') await handleRun(msg);
  else if (msg.type === 'cancel') handleCancel(msg.runId);
  else if (msg.type === 'message') handleMessage(msg);
  else if (msg.type === 'webdav:save:reply') handleWebdavSaveReply(msg);
  else if (msg.type === 'webdav:read:reply') handleWebdavReadReply(msg);
});

process.send({ type: 'ready' });

// ── Dispatch ────────────────────────────────────────────────────────────────

function resolveWorker(agentId) {
  const entry = _agents.get(agentId);
  if (!entry) return null;
  if (entry.module) return entry;
  const workerPath = entry.manifest.entry?.worker;
  if (!workerPath) return null;
  entry.module = require(path.join(entry.dir, workerPath));
  return entry;
}

async function handleRun({ runId, agentId, params }) {
  const ac = new AbortController();
  abortControllers.set(runId, ac);
  try {
    const entry = resolveWorker(agentId);
    if (!entry) {
      sendError(runId, agentId, `Unknown agent: ${agentId}`);
      return;
    }
    const mod = entry.module;
    if (typeof mod.run !== 'function') {
      sendError(runId, agentId, `Agent "${agentId}" worker does not export a run() function`);
      return;
    }

    const ctx = {
      runId,
      agentId,
      params,
      signal: ac.signal,
      sendProgress: (message, level) => sendProgress(runId, agentId, message, level),
      helpers: buildHelpers(entry.manifest.capabilities || {}, agentId),
      // Legacy shape — some existing agent code reaches for these top-level functions.
      requestWebdavSave,
      requestWebdavRead,
    };
    await mod.run(ctx);
  } catch (err) {
    if (!ac.signal.aborted) {
      sendError(runId, agentId, err.message || String(err));
    } else {
      process.send({ type: 'done', runId, agentId, result: null, cancelled: true });
    }
  } finally {
    abortControllers.delete(runId);
  }
}

function handleCancel(runId) {
  abortControllers.get(runId)?.abort();
}

function handleMessage({ runId, agentId, data }) {
  // If agentId is provided, dispatch to that agent's receiveMessage; otherwise
  // broadcast to any agent that declares messaging support. (Existing callers
  // pass runId only; we infer agentId from the pending run if possible.)
  const targets = [];
  if (agentId) {
    targets.push(agentId);
  } else {
    for (const [id, entry] of _agents) {
      if (entry.manifest.capabilities?.messaging) targets.push(id);
    }
  }
  for (const id of targets) {
    const entry = _agents.get(id);
    if (!entry?.module) continue;
    const fn = typeof entry.module.receiveMessage === 'function'
      ? entry.module.receiveMessage
      : null;
    if (fn) {
      try { fn(runId, data); } catch (err) { console.error('receiveMessage failed:', err); }
    }
  }
}

// ── Helpers surface passed to agent.run() ───────────────────────────────────

function buildHelpers(capabilities, agentId) {
  const helpers = {};
  if (capabilities.webdav === 'read' || capabilities.webdav === 'write' || capabilities.webdav === true) {
    helpers.webdav = {
      read: (filePath) => requestWebdavRead(filePath),
      write: (filePath, content, dirPath) => requestWebdavSave(filePath, dirPath || null, content),
      exists: async (filePath) => {
        try {
          await requestWebdavRead(filePath);
          return true;
        } catch (err) {
          const msg = String(err?.message || '');
          if (/404|not ?found/i.test(msg)) return false;
          throw err;
        }
      },
    };
  }
  // Only agents that declare `capabilities.pages` may steer the main window.
  if (capabilities.pages) {
    helpers.openWebdavFile = (filePath) => requestOpenWebdavFile(agentId, filePath);
  }
  return helpers;
}

// ── WebDAV save via main process ────────────────────────────────────────────

function handleWebdavSaveReply(msg) {
  const pending = _pendingWebdavSaves.get(msg.reqId);
  if (!pending) return;
  _pendingWebdavSaves.delete(msg.reqId);
  if (msg.success) pending.resolve(msg.filePath);
  else pending.reject(new Error(msg.error || 'WebDAV save failed'));
}

function requestWebdavSave(filePath, dirPath, content) {
  const reqId = ++_webdavSaveSeq;
  return new Promise((resolve, reject) => {
    _pendingWebdavSaves.set(reqId, { resolve, reject });
    process.send({ type: 'webdav:save', reqId, filePath, dirPath, content });
  });
}

function handleWebdavReadReply(msg) {
  const pending = _pendingWebdavReads.get(msg.reqId);
  if (!pending) return;
  _pendingWebdavReads.delete(msg.reqId);
  if (msg.success) pending.resolve(msg.content);
  else pending.reject(new Error(msg.error || 'WebDAV read failed'));
}

function requestWebdavRead(filePath) {
  const reqId = ++_webdavReadSeq;
  return new Promise((resolve, reject) => {
    _pendingWebdavReads.set(reqId, { resolve, reject });
    process.send({ type: 'webdav:read', reqId, filePath });
  });
}

// Send a side-channel message asking main to open a WebDAV file in the viewer.
// Fire-and-forget — the renderer loads the file asynchronously.
function requestOpenWebdavFile(agentId, filePath) {
  process.send({ type: 'open:webdavFile', agentId, filePath });
  return Promise.resolve();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sendProgress(runId, agentId, message, level = 'info') {
  process.send({ type: 'progress', runId, agentId, message, level });
}

function sendError(runId, agentId, message) {
  process.send({ type: 'error', runId, agentId, message });
}
