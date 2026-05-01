// Generic agent UI host — mounts the right UI for an agent based on its manifest.
//
// Tiers (progressive disclosure — see agentskills.io for the broader spec this
// mirrors):
//
//   Tier 0  — declarative: manifest.params only. Shell renders a form + log +
//             output pane, all by shape (markdown/html/json/text).
//   Tier 1  — custom output: agent ui.js exports renderOutput(host, data).
//             Shell still owns the params form + log; agent controls output.
//   Tier 2  — full control: agent ships ui.html (+ optional ui.css, ui.js with
//             mount/unmount). Shell hands the panel over entirely.
//
// Tier 2 agents ship ui.html/ui.css/ui.js in their folder and are loaded here
// dynamically. Tier 0 and Tier 1 agents are rendered via the auto-form helpers
// below; Tier 1 may additionally export renderOutput for custom output rendering.

'use strict';

const _inlineAdapters = new Map(); // agentId → { mount, unmount }

function registerInlineAdapter(agentId, { mount, unmount } = {}) {
  _inlineAdapters.set(agentId, { mount, unmount });
}

function getInlineAdapter(agentId) {
  return _inlineAdapters.get(agentId) || null;
}

function detectTier(manifest) {
  const entry = manifest?.entry || {};
  const ui = entry.ui || {};
  if (ui.html) return 2;
  if (ui.js) return 1;
  return 0;
}

// ── Tier 0 auto-form ──

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderAutoForm(container, manifest) {
  container.innerHTML = '';
  const params = Array.isArray(manifest?.params) ? manifest.params : [];
  if (params.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'agents-param-hint';
    hint.textContent = 'No parameters — click Run to execute.';
    container.appendChild(hint);
    return;
  }
  for (const p of params) {
    const row = document.createElement('div');
    row.className = 'agents-param-row';

    if (p.type === 'checkbox') {
      const wrapper = document.createElement('label');
      wrapper.className = 'agents-param-inline-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.paramName = p.name;
      input.dataset.paramType = 'checkbox';
      if (p.default === true) input.checked = true;
      wrapper.appendChild(input);
      const text = document.createElement('span');
      text.textContent = p.label || p.name;
      wrapper.appendChild(text);
      row.appendChild(wrapper);
    } else {
      if (p.label) {
        const label = document.createElement('label');
        label.className = 'agents-param-label';
        label.textContent = p.label;
        label.setAttribute('for', `param-${p.name}`);
        row.appendChild(label);
      }
      let input;
      if (p.type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'agents-param-textarea';
        input.rows = p.rows || 4;
      } else if (p.type === 'select' && Array.isArray(p.options)) {
        input = document.createElement('select');
        for (const opt of p.options) {
          const o = document.createElement('option');
          o.value = String(opt.value ?? opt);
          o.textContent = String(opt.label ?? opt.value ?? opt);
          input.appendChild(o);
        }
      } else if (p.type === 'number') {
        input = document.createElement('input');
        input.type = 'number';
      } else {
        input = document.createElement('input');
        input.type = 'text';
      }
      input.id = `param-${p.name}`;
      input.dataset.paramName = p.name;
      input.dataset.paramType = p.type || 'text';
      if (p.placeholder) input.placeholder = p.placeholder;
      if (p.default !== undefined && p.default !== null) input.value = String(p.default);
      row.appendChild(input);
    }

    if (p.hint) {
      const h = document.createElement('p');
      h.className = 'agents-param-hint';
      h.textContent = p.hint;
      row.appendChild(h);
    }
    container.appendChild(row);
  }
}

function collectAutoFormParams(container) {
  const params = {};
  if (!container) return params;
  const inputs = container.querySelectorAll('[data-param-name]');
  for (const el of inputs) {
    const name = el.dataset.paramName;
    const type = el.dataset.paramType || 'text';
    if (type === 'checkbox') {
      params[name] = el.checked;
    } else if (type === 'number') {
      const v = el.value;
      params[name] = v === '' ? null : Number(v);
    } else {
      params[name] = el.value;
    }
  }
  return params;
}

// ── Tier 2 dynamic mount ──

const _tier2State = new Map();

async function mountTier2(agentId, manifest, hostEl, api, dir) {
  const ui = manifest.entry.ui;
  const htmlPath = `${dir}/${ui.html}`;
  const res = await fetch(htmlPath);
  const html = await res.text();

  let linkEl = null;
  if (ui.css) {
    linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = `${dir}/${ui.css}`;
    linkEl.dataset.agentCss = agentId;
    document.head.appendChild(linkEl);
  }

  hostEl.innerHTML = html;

  let mod = null;
  if (ui.js) {
    try {
      mod = await import(`${dir}/${ui.js}`);
    } catch (err) {
      console.error(`ui-host: failed to import ${dir}/${ui.js}`, err);
    }
  }

  if (mod?.mount) {
    await mod.mount({ host: hostEl, api });
  }

  _tier2State.set(agentId, { mod, linkEl, hostEl });
}

async function unmountTier2(agentId) {
  const state = _tier2State.get(agentId);
  if (!state) return;
  const { mod, linkEl, hostEl } = state;
  if (mod?.unmount) {
    try { await mod.unmount(); } catch (err) { console.error('ui-host: unmount error', err); }
  }
  if (linkEl && linkEl.parentNode) linkEl.parentNode.removeChild(linkEl);
  if (hostEl) hostEl.innerHTML = '';
  _tier2State.delete(agentId);
}

// ── Settings modal slot ──
// Tier-2 agents can inject a fragment into the global Settings modal by
// appending into the slot element `#settings-slot-<agentId>`. The slot must
// exist in index.html; this helper returns it or null.

function settingsSlot(agentId) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(`settings-slot-${agentId}`) || null;
}

// ── Public surface ──

async function mount(agentId, manifest, hostEl, api, dir) {
  const adapter = getInlineAdapter(agentId);
  if (adapter?.mount) {
    await adapter.mount({ manifest, host: hostEl, api });
    return { tier: 'inline' };
  }
  const tier = detectTier(manifest);
  if (tier === 2 && dir && hostEl) {
    await mountTier2(agentId, manifest, hostEl, api, dir);
    return { tier: 2 };
  }
  return { tier };
}

async function unmount(agentId) {
  const adapter = getInlineAdapter(agentId);
  if (adapter?.unmount) {
    try { await adapter.unmount(); } catch (err) { console.error('ui-host: inline unmount error', err); }
    return;
  }
  await unmountTier2(agentId);
}

// Tier-2 agents may export `renderOutput(host, data)` from their `ui.js` to
// take over rendering of the output pane (see Tier-1 pattern documented at
// the top of this file — this extends it to Tier 2). Returns true if the
// agent handled the render, false otherwise so callers can fall back to the
// default markdown path.
function renderOutput(agentId, host, data) {
  const state = _tier2State.get(agentId);
  const fn = state?.mod?.renderOutput;
  if (typeof fn !== 'function') return false;
  try {
    const ret = fn(host, data);
    return ret === false ? false : true;
  } catch (err) {
    console.error(`ui-host: renderOutput error for ${agentId}`, err);
    return false;
  }
}

// Renderer-side export via globalThis so app.js can pick it up without a bundler.
if (typeof window !== 'undefined') {
  window.__agentUiHost = {
    mount,
    unmount,
    detectTier,
    registerInlineAdapter,
    getInlineAdapter,
    renderAutoForm,
    collectAutoFormParams,
    settingsSlot,
    renderOutput,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mount,
    unmount,
    detectTier,
    registerInlineAdapter,
    getInlineAdapter,
    renderAutoForm,
    collectAutoFormParams,
    settingsSlot,
    renderOutput,
  };
}
