// Diff pop-up renderer. Talks to main via window.popupAPI (preload-popup.js).
// State model: one current round; tabs = files touched in that round.

(function () {
  'use strict';

  const api = window.popupAPI;
  if (!api) {
    document.body.innerHTML = '<div style="padding:20px;color:#f85149">popupAPI missing — preload failed to load.</div>';
    return;
  }

  // Mirror main window's font configuration — keeps popup text compatible
  // with the user's Settings → General → Display choices.
  const DEFAULT_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";
  const DEFAULT_FONT_MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
  function applyFontSettings(s) {
    const root = document.documentElement.style;
    const gen = (s && s.general) || {};
    const ff = (gen.fontFamily || '').trim();
    root.setProperty('--font-family', ff && ff !== 'System Default' ? `'${ff}', ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY);
    const fs = (gen.fontSize || 14) + 'px';
    root.setProperty('--font-size', fs);
    root.setProperty('--font-mono', DEFAULT_FONT_MONO);
    root.setProperty('--font-size-mono', fs);
    root.setProperty('--ui-scale', gen.uiScale || 1);
  }
  if (typeof api.loadSettings === 'function') {
    api.loadSettings().then(applyFontSettings).catch(() => {});
  }
  if (typeof api.onSettingsChanged === 'function') {
    api.onSettingsChanged(applyFontSettings);
  }

  const $ = (id) => document.getElementById(id);
  const sessionEl = $('popup-session');
  const statsEl = $('popup-stats');
  const turnInfoEl = $('popup-turn-info');
  const tabsEl = $('diff-tabs');
  const bodyEl = $('diff-body');
  const btnRebind = $('btn-rebind');
  const btnPin = $('btn-pin');
  const btnHelp = $('btn-help');
  const btnClose = $('btn-close');

  const pickerModal = $('picker-modal');
  const pickerList = $('picker-list');
  const pickerHint = $('picker-hint');
  const pickerError = $('picker-error');
  const pickerLoading = $('picker-loading');
  const btnPickerCancel = $('btn-picker-cancel');
  const btnPickerClose = $('btn-picker-close');
  const btnPickerConfirm = $('btn-picker-confirm');
  const helpModal = $('help-modal');

  const state = {
    binding: null,            // { scope, sessionId, path, cwd }
    turnId: null,
    files: [],                // [{ filePath, adds, dels, status, kind, editIndex, timestamp }]
    activeFilePath: null,
    activeHunkIndex: 0,
    hunkCache: new Map(),     // filePath -> { hunks, status, tier, ... }
    pickerOpen: false,
    pickerSelection: null,
    pickerSessions: [],
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatRelativeTime(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const delta = (Date.now() - t) / 1000;
    if (delta < 60) return 'just now';
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return `${Math.floor(delta / 86400)}d ago`;
  }

  function fileBaseName(p) {
    if (!p) return '';
    const parts = p.split('/');
    return parts[parts.length - 1] || p;
  }

  // ── Session label / stats ──────────────────────────────────────────────

  function renderSessionLabel() {
    if (!state.binding) {
      sessionEl.textContent = 'No session bound';
      return;
    }
    const { cwd, sessionId } = state.binding;
    sessionEl.textContent = `${cwd || ''} · ${(sessionId || '').slice(0, 8)}`;
  }

  function renderStats() {
    let adds = 0, dels = 0;
    for (const f of state.files) { adds += f.adds; dels += f.dels; }
    const n = state.files.length;
    statsEl.innerHTML = n
      ? `${n} file${n !== 1 ? 's' : ''} · <span class="add">+${adds}</span> <span class="del">−${dels}</span>`
      : '';
    turnInfoEl.textContent = state.turnId ? `round ${state.turnId.slice(0, 8)}` : '';
  }

  // ── Tabs ───────────────────────────────────────────────────────────────

  function renderTabs(pulseFilePath) {
    tabsEl.innerHTML = '';
    if (!state.files.length) return;
    state.files.forEach((f) => {
      const tab = document.createElement('button');
      tab.className = 'diff-tab';
      if (f.filePath === state.activeFilePath) tab.classList.add('active');
      if (pulseFilePath && f.filePath === pulseFilePath) tab.classList.add('pulse');
      tab.setAttribute('role', 'tab');
      tab.dataset.filePath = f.filePath;
      const name = fileBaseName(f.filePath);
      const badge = f.status === 'added' ? '<span class="diff-tab-badge">new</span>' : '';
      tab.innerHTML = `
        <span class="diff-tab-name">${escapeHtml(name)}</span>
        ${badge}
        <span class="diff-tab-stats"><span class="add">+${f.adds}</span> <span class="del">−${f.dels}</span></span>
      `;
      tab.title = f.filePath;
      tab.addEventListener('click', () => selectFile(f.filePath));
      tabsEl.appendChild(tab);
    });
    // Scroll active tab into view.
    const active = tabsEl.querySelector('.diff-tab.active');
    if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  // ── Body (hunks) ───────────────────────────────────────────────────────

  function renderEmptyBody() {
    bodyEl.innerHTML = `
      <div class="diff-placeholder">
        <div class="big">Waiting for Claude's next edit…</div>
        ${state.binding ? '' : '<div class="hint">Press <kbd>Session</kbd> or <kbd>b</kbd> to choose a Claude Code session.</div>'}
      </div>
    `;
  }

  function renderPlaceholder(text) {
    bodyEl.innerHTML = `<div class="diff-placeholder"><div class="big">${escapeHtml(text)}</div></div>`;
  }

  async function renderActiveFile() {
    const filePath = state.activeFilePath;
    if (!filePath) return renderEmptyBody();
    let data = state.hunkCache.get(filePath);
    if (!data) {
      renderPlaceholder('Loading…');
      let res;
      try { res = await api.diffGetHunks(filePath); }
      catch (e) { return renderPlaceholder('Error: ' + (e.message || e)); }
      if (!res || !res.success) return renderPlaceholder('Error: ' + (res && res.error || 'failed'));
      data = res;
      state.hunkCache.set(filePath, data);
    }

    const meta = state.files.find((f) => f.filePath === filePath);
    const parts = [];
    const statusClass = data.status === 'added' ? 'status-added' : 'status-modified';
    parts.push(`
      <div class="diff-file-header">
        <div class="path">${escapeHtml(filePath)}</div>
        <div class="meta">
          <span class="${statusClass}">${escapeHtml(data.status)}</span>
          <span>${escapeHtml(data.kind || 'edit')}</span>
          ${meta ? `<span class="add">+${meta.adds}</span><span class="del">−${meta.dels}</span>` : ''}
          ${data.tier === 'drop' ? '<span>large file — preview unavailable</span>' : ''}
        </div>
      </div>
    `);

    if (data.tier === 'drop') {
      parts.push('<div class="diff-placeholder"><div class="hint">File exceeds the preview size limit.</div></div>');
    } else if (!data.hunks || data.hunks.length === 0) {
      parts.push('<div class="diff-placeholder"><div class="hint">No hunks.</div></div>');
    } else {
      data.hunks.forEach((h, idx) => {
        const header = `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`;
        const lines = h.lines.map((ln) => {
          const marker = ln[0] || ' ';
          const body = ln.slice(1);
          const cls = marker === '+' ? 'add' : (marker === '-' ? 'del' : 'ctx');
          return `<span class="diff-line ${cls}"><span class="diff-line-marker">${marker}</span>${escapeHtml(body)}</span>`;
        }).join('');
        parts.push(`
          <div class="diff-hunk" data-hunk-index="${idx}">
            <div class="diff-hunk-header">
              <span>${escapeHtml(header)}</span>
              <span>${h.lines.length} lines</span>
            </div>
            <div class="diff-hunk-lines">${lines}</div>
          </div>
        `);
      });
    }
    bodyEl.innerHTML = parts.join('');
    bodyEl.querySelectorAll('.diff-hunk-header').forEach((hdr) => {
      hdr.addEventListener('click', () => hdr.parentElement.classList.toggle('collapsed'));
    });
    bodyEl.scrollTop = 0;
    state.activeHunkIndex = 0;
    markActiveHunk();
  }

  function markActiveHunk() {
    const hunks = bodyEl.querySelectorAll('.diff-hunk');
    hunks.forEach((h, i) => h.classList.toggle('hunk-active', i === state.activeHunkIndex));
  }

  function selectFile(filePath) {
    state.activeFilePath = filePath;
    renderTabs();
    renderActiveFile();
  }

  // ── Snapshot hydration ─────────────────────────────────────────────────

  async function hydrateSnapshot(pulseFilePath) {
    let res;
    try { res = await api.diffSnapshot(); }
    catch (_e) { return; }
    if (!res || !res.success) return;
    state.turnId = res.turnId || null;
    state.files = res.files || [];
    // Clear hunk cache for any file whose timestamp we may have missed —
    // simplest: clear all on snapshot; re-fetched lazily on render.
    state.hunkCache.clear();
    if (!state.files.length) {
      state.activeFilePath = null;
      renderTabs();
      renderStats();
      renderEmptyBody();
      return;
    }
    if (pulseFilePath && state.files.find((f) => f.filePath === pulseFilePath)) {
      state.activeFilePath = pulseFilePath;
    } else if (!state.activeFilePath || !state.files.find((f) => f.filePath === state.activeFilePath)) {
      state.activeFilePath = state.files[0].filePath;
    }
    renderTabs(pulseFilePath);
    renderStats();
    await renderActiveFile();
  }

  // ── Push updates ───────────────────────────────────────────────────────

  api.onDiffUpdated(async (data) => {
    if (!data) return;
    // Ignore updates targeted at other tabs (shouldn't happen in popup, but safe).
    if (data.tabId && data.tabId !== 'popup') return;
    // Auto-jump to the file that changed.
    const pulse = data.filePath || null;
    await hydrateSnapshot(pulse);
  });
  api.onDiffError((err) => {
    console.warn('[diff] error', err);
  });

  // ── Session picker ─────────────────────────────────────────────────────

  async function openPicker() {
    state.pickerOpen = true;
    state.pickerSelection = null;
    btnPickerConfirm.disabled = true;
    pickerError.classList.add('hidden');
    pickerLoading.classList.remove('hidden');
    pickerList.innerHTML = '';
    pickerModal.classList.remove('hidden');

    let res;
    try { res = await api.diffListSessions(); }
    catch (e) {
      pickerLoading.classList.add('hidden');
      pickerError.textContent = 'Failed to list sessions: ' + (e.message || e);
      pickerError.classList.remove('hidden');
      return;
    }
    pickerLoading.classList.add('hidden');
    if (!res || !res.success) {
      pickerError.textContent = res && res.error || 'Could not list sessions.';
      pickerError.classList.remove('hidden');
      applyHostBadge(res && res.context);
      return;
    }
    state.pickerSessions = res.sessions || [];
    state.pickerContext = res.context || null;
    applyHostBadge(state.pickerContext);
    if (!state.pickerSessions.length) {
      const ctx = state.pickerContext || {};
      const host = ctx.hostLabel || 'local';
      const scope = ctx.scope === 'remote' ? `${host}:${ctx.remoteHome || '~'}/.claude/projects/` : '~/.claude/projects/';
      pickerList.innerHTML = `<p class="picker-hint">No Claude sessions found under ${escapeHtml(scope)}</p>`;
      return;
    }
    renderPickerList();
  }

  function applyHostBadge(ctx) {
    const badge = document.getElementById('host-badge');
    if (!badge) return;
    const label = (ctx && ctx.hostLabel) || 'local';
    badge.textContent = label;
    badge.classList.toggle('host-badge-remote', !!(ctx && ctx.scope === 'remote'));
  }

  function renderPickerList() {
    pickerList.innerHTML = '';
    state.pickerSessions.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.dataset.sessionId = s.sessionId;
      item.dataset.idx = String(idx);
      item.innerHTML = `
        <div class="picker-item-head">
          <span>${escapeHtml(s.cwd || s.sessionId)}</span>
          <span class="picker-item-time">${escapeHtml(formatRelativeTime(s.updatedAt))}</span>
        </div>
        ${s.snippet ? `<div class="picker-item-snippet">${escapeHtml(s.snippet)}</div>` : ''}
        <div class="picker-item-meta">
          ${s.gitBranch ? `<span>⎇ ${escapeHtml(s.gitBranch)}</span>` : ''}
          <span>${escapeHtml(s.sessionId.slice(0, 8))}</span>
        </div>
      `;
      item.addEventListener('click', () => setPickerSelection(idx));
      item.addEventListener('dblclick', () => { setPickerSelection(idx); confirmPicker(); });
      pickerList.appendChild(item);
    });
    if (state.pickerSessions.length) setPickerSelection(0);
  }

  function setPickerSelection(idx) {
    if (!state.pickerSessions.length) return;
    const clamped = Math.max(0, Math.min(state.pickerSessions.length - 1, idx));
    state.pickerSelectionIdx = clamped;
    state.pickerSelection = state.pickerSessions[clamped];
    btnPickerConfirm.disabled = false;
    const rows = pickerList.querySelectorAll('.picker-item');
    rows.forEach((el, i) => el.classList.toggle('selected', i === clamped));
    const active = rows[clamped];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function closePicker() {
    state.pickerOpen = false;
    pickerModal.classList.add('hidden');
  }

  async function confirmPicker() {
    if (!state.pickerSelection) return;
    const s = state.pickerSelection;
    const scope = (state.pickerContext && state.pickerContext.scope) || 'local';
    const bind = await api.diffBindSession({
      tabId: 'popup', scope, sessionId: s.sessionId, path: s.filePath,
    });
    if (!bind || !bind.success) {
      pickerError.textContent = bind && bind.error || 'Failed to bind session.';
      pickerError.classList.remove('hidden');
      return;
    }
    state.binding = { scope: 'local', sessionId: s.sessionId, path: s.filePath, cwd: s.cwd };
    closePicker();
    renderSessionLabel();
    await api.diffSubscribe();
    await hydrateSnapshot();
  }

  // ── Init ───────────────────────────────────────────────────────────────

  btnRebind.addEventListener('click', openPicker);
  btnClose.addEventListener('click', () => api.diffCloseWindow());
  btnHelp.addEventListener('click', () => helpModal.classList.toggle('hidden'));
  btnPin.addEventListener('click', async () => {
    const pinned = await api.diffTogglePin();
    btnPin.classList.toggle('active', !!pinned);
  });
  btnPickerCancel.addEventListener('click', closePicker);
  btnPickerClose.addEventListener('click', closePicker);
  btnPickerConfirm.addEventListener('click', confirmPicker);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (state.pickerOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
      if (!state.pickerSessions.length) return;
      const cur = state.pickerSelectionIdx == null ? -1 : state.pickerSelectionIdx;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setPickerSelection(cur + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setPickerSelection(cur - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setPickerSelection(0); }
      else if (e.key === 'End') { e.preventDefault(); setPickerSelection(state.pickerSessions.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); confirmPicker(); }
      return;
    }
    if (!helpModal.classList.contains('hidden')) {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); helpModal.classList.add('hidden'); }
      return;
    }
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    if (typing) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      api.diffCloseWindow();
      return;
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); navFile(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navFile(+1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bodyEl.scrollBy({ top: -80 }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bodyEl.scrollBy({ top: 80 }); }
    else if (e.key === 'PageUp') { e.preventDefault(); bodyEl.scrollBy({ top: -bodyEl.clientHeight * 0.9 }); }
    else if (e.key === 'PageDown') { e.preventDefault(); bodyEl.scrollBy({ top: bodyEl.clientHeight * 0.9 }); }
    else if (e.key === 'p') { e.preventDefault(); navHunk(-1); }
    else if (e.key === 'n') { e.preventDefault(); navHunk(+1); }
    else if (e.key === 'b') { e.preventDefault(); openPicker(); }
    else if (e.key === '?') { e.preventDefault(); helpModal.classList.toggle('hidden'); }
    else if (e.key === ' ') {
      e.preventDefault();
      const hunks = bodyEl.querySelectorAll('.diff-hunk');
      const target = hunks[state.activeHunkIndex];
      if (target) target.classList.toggle('collapsed');
    }
  }, true);

  function navFile(delta) {
    if (!state.files.length) return;
    const idx = state.files.findIndex((f) => f.filePath === state.activeFilePath);
    const next = Math.max(0, Math.min(state.files.length - 1, idx + delta));
    if (state.files[next]) selectFile(state.files[next].filePath);
  }

  function navHunk(delta) {
    const hunks = bodyEl.querySelectorAll('.diff-hunk');
    if (!hunks.length) return;
    state.activeHunkIndex = Math.max(0, Math.min(hunks.length - 1, state.activeHunkIndex + delta));
    const target = hunks[state.activeHunkIndex];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    markActiveHunk();
  }

  // Confidence-tiered auto-bind:
  //   sure     — bind directly to this tab's claude session, no picker
  //   guess    — open picker (use cached binding only if cwd still matches)
  //   unknown  — open picker (no pre-select)
  // Always re-resolves the tab's current session first; the cache only wins
  // when the fresh (cwd, sessionId) still matches. This way a claude restart
  // in the same tab doesn't keep showing the old session.
  async function bindAndHydrate({ scope, sessionId, path, cwd }) {
    try { await api.diffUnsubscribe(); } catch (_) {}
    const bind = await api.diffBindSession({ tabId: 'popup', scope, sessionId: sessionId || null, path, cwd: cwd || null });
    if (!bind || !bind.success) return false;
    state.binding = { scope, sessionId, path, cwd };
    state.turnId = null;
    state.files = [];
    state.activeFilePath = null;
    state.hunkCache.clear();
    renderSessionLabel();
    await api.diffSubscribe();
    await hydrateSnapshot();
    return true;
  }

  async function autoDetectOrPick() {
    renderEmptyBody();
    let res;
    try { res = await api.diffResolveTabSession(); }
    catch (_) { await openPicker(); return; }
    if (!res || !res.success) { await openPicker(); return; }
    state.pickerContext = res.context || null;
    applyHostBadge(state.pickerContext);

    const scope = (res.context && res.context.scope) || 'local';

    if (res.tier === 'sure' && res.sessionPath) {
      // Prefer the cached per-tab binding only if it still matches the tab's
      // current session — otherwise bind fresh and let main overwrite the
      // stale entry via diff:bindSession.
      let cached = null;
      if (api.diffGetTabBinding) {
        try {
          const tb = await api.diffGetTabBinding();
          if (tb && tb.success && tb.binding) cached = tb.binding;
        } catch (_) { /* ignore */ }
      }
      const reusable = cached && cached.path && cached.sessionId === res.sessionId && cached.path === res.sessionPath;
      if (reusable) {
        state.pickerContext = { scope: cached.scope || scope, cwd: cached.cwd || res.cwd || null, hostLabel: cached.scope === 'remote' ? (cached.remoteKey || 'remote') : 'local' };
        applyHostBadge(state.pickerContext);
        if (await bindAndHydrate({ scope: cached.scope || scope, sessionId: cached.sessionId, path: cached.path, cwd: cached.cwd })) return;
      }
      if (await bindAndHydrate({ scope, sessionId: res.sessionId, path: res.sessionPath, cwd: res.cwd })) return;
      // Bind failed — fall through to picker.
    }

    // tier === 'guess' or 'unknown', or 'sure' bind failed. Reuse any cached
    // binding this tab has. We can't verify freshness without a 'sure' tier
    // (e.g. on Mac, tier is always 'unknown'), so we trust the cache and let
    // the user manually re-pick if claude was restarted in the same tab.
    if (api.diffGetTabBinding) {
      try {
        const tb = await api.diffGetTabBinding();
        const b = tb && tb.success && tb.binding;
        if (b && b.path) {
          state.pickerContext = { scope: b.scope || scope, cwd: b.cwd || null, hostLabel: b.scope === 'remote' ? (b.remoteKey || 'remote') : 'local' };
          applyHostBadge(state.pickerContext);
          if (await bindAndHydrate({ scope: b.scope || scope, sessionId: b.sessionId, path: b.path, cwd: b.cwd })) return;
        }
      } catch (_) { /* fall through */ }
    }

    await openPicker();
    if (res.tier === 'guess' && res.cwd && state.pickerSessions && state.pickerSessions.length) {
      const idx = state.pickerSessions.findIndex((s) => s.cwd === res.cwd);
      if (idx >= 0) setPickerSelection(idx);
    }
  }

  // Tab-switch push from main: re-run auto-detect for the new tab.
  if (api.onDiffTabSwitched) {
    api.onDiffTabSwitched(() => { autoDetectOrPick(); });
  }

  // Boot: always auto-detect against the current tab's context on first open.
  // Persisted bindings are ignored to avoid leaking state across tabs/sessions.
  async function boot() {
    await autoDetectOrPick();
  }

  boot();
})();
