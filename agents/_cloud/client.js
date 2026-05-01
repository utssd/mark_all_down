'use strict';

// Generic fetch-based SSE client for MAD's cloud-agents service.
//
// A CloudAgentSession represents one agent run on a remote backend. Routes and
// HTTP methods come from the agent's AGENT.md manifest (manifest.cloud.*) —
// this module has no hard-coded agent IDs or paths, so it can drive any
// hybrid/cloud agent the user drops in.
//
// Path templates: `{sessionId}` is substituted from the session id captured on
// the first response (either the `sessionId` field of a JSON payload or the
// `session` SSE event, whichever arrives first).
//
// Events are delivered via onEvent in the same shape the local worker uses, so
// renderer code stays provider-agnostic:
//   { type: 'progress'|'error'|'done', agentId, message?, result?, cancelled? }

class CloudAgentSession {
  /**
   * @param {{
   *   baseUrl: string,
   *   jwt?: string,
   *   agentId: string,
   *   manifest: object,
   *   onEvent: (evt: object) => void,
   * }} opts
   */
  constructor({ baseUrl, jwt, agentId, manifest, onEvent }) {
    if (!baseUrl) throw new Error('cloud-agents: baseUrl is required');
    if (!manifest?.cloud?.run) {
      throw new Error(`cloud-agents: agent "${agentId}" has no cloud.run route in manifest`);
    }
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.jwt = jwt || '';
    this.agentId = agentId;
    this.manifest = manifest;
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.abortController = new AbortController();
    this.sessionId = null;
    this._done = false;
  }

  async run(params) {
    const route = this.manifest.cloud.run;
    const url = this._resolve(route.path, {});
    const res = await this._fetch(route.method || 'POST', url, params);
    await this._consumeSse(res);
  }

  async sendMessage(data) {
    const route = this.manifest.cloud.message;
    if (!route) {
      this.onEvent({ type: 'error', agentId: this.agentId, message: 'cloud.message route not declared' });
      return;
    }
    if (!this.sessionId) return;
    try {
      await this._fetch(
        route.method || 'POST',
        this._resolve(route.path, { sessionId: this.sessionId }),
        data,
      );
    } catch (err) {
      this.onEvent({ type: 'error', agentId: this.agentId, message: err.message });
    }
  }

  async cancel() {
    const route = this.manifest.cloud.cancel;
    if (route && this.sessionId) {
      try {
        await this._fetch(
          route.method || 'DELETE',
          this._resolve(route.path, { sessionId: this.sessionId }),
        );
      } catch (_) {}
    }
    try { this.abortController.abort(); } catch (_) {}
  }

  _resolve(pathTemplate, vars) {
    return pathTemplate.replace(/\{(\w+)\}/g, (_, key) => {
      const v = vars[key];
      return v == null ? '' : encodeURIComponent(String(v));
    });
  }

  async _fetch(method, pathname, body) {
    const url = `${this.baseUrl}${pathname}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json',
    };
    if (this.jwt) headers['Authorization'] = `Bearer ${this.jwt}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: this.abortController.signal,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) {}
      throw new Error(`cloud-agents ${method} ${pathname} → HTTP ${res.status}: ${detail || res.statusText}`);
    }
    return res;
  }

  async _consumeSse(res) {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/event-stream')) {
      let payload = null;
      try { payload = await res.json(); } catch (_) {}
      if (payload?.sessionId) this.sessionId = payload.sessionId;
      this._emitDone(payload || {});
      return;
    }

    const reader = res.body?.getReader?.();
    if (!reader) throw new Error('cloud-agents: response body is not readable');
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = indexOfEventBoundary(buffer)) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const evt = parseSseBlock(block);
          if (evt) this._handleSseEvent(evt);
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (!this._done) this._emitCancelled();
        return;
      }
      if (!this._done) this.onEvent({ type: 'error', agentId: this.agentId, message: err.message });
      return;
    } finally {
      try { reader.releaseLock?.(); } catch (_) {}
    }

    if (!this._done) this._emitDone({});
  }

  _handleSseEvent({ event, data }) {
    let payload;
    try { payload = JSON.parse(data); } catch (_) { payload = { raw: data }; }

    if (event === 'session') {
      if (payload?.sessionId) this.sessionId = payload.sessionId;
      return;
    }

    // session_start also carries the session id (snake_case variant).
    // Capture it, but fall through so ui.js still receives the event payload
    // (speakers list etc.) via the generic pass-through below.
    if (event === 'session_start') {
      if (payload?.session_id) this.sessionId = payload.session_id;
      if (payload?.sessionId)  this.sessionId = payload.sessionId;
    }

    const translated = translateEvent(event, payload, this.agentId);
    if (!translated) return;
    if (translated.type === 'done') this._done = true;
    this.onEvent(translated);
  }

  _emitDone(result) {
    if (this._done) return;
    this._done = true;
    this.onEvent({ type: 'done', agentId: this.agentId, result, cancelled: false });
  }

  _emitCancelled() {
    if (this._done) return;
    this._done = true;
    this.onEvent({ type: 'done', agentId: this.agentId, result: null, cancelled: true });
  }
}

function indexOfEventBoundary(buffer) {
  const a = buffer.indexOf('\n\n');
  const b = buffer.indexOf('\r\n\r\n');
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let event = 'message';
  const dataLines = [];
  for (const raw of lines) {
    if (!raw || raw.startsWith(':')) continue;
    const colon = raw.indexOf(':');
    const field = colon === -1 ? raw : raw.slice(0, colon);
    let value = colon === -1 ? '' : raw.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

function translateEvent(event, payload, agentId) {
  switch (event) {
    case 'progress':
      return { type: 'progress', agentId, message: payload, level: payload?.level || 'info' };
    case 'log':
      return { type: 'progress', agentId, message: payload?.message || '', level: payload?.level || 'info' };
    case 'error':
      return { type: 'error', agentId, message: payload?.message || 'Unknown error' };
    case 'done':
      return { type: 'done', agentId, result: payload || {}, cancelled: payload?.reason === 'cancelled' };
    case 'cancelled':
      return { type: 'done', agentId, result: null, cancelled: true };
    default:
      // Generic pass-through: anything else becomes a progress event tagged
      // with { kind: event }. Common event names include session_start,
      // speech_*, closing_*, reflection, synthesis_*, round_complete.
      return {
        type: 'progress',
        agentId,
        message: {
          kind: event,
          ...(payload && typeof payload === 'object' && !Array.isArray(payload)
            ? payload
            : { payload }),
        },
        level: 'info',
      };
  }
}

module.exports = { CloudAgentSession };
