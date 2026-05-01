// Plan pop-up renderer. Talks to main via window.popupAPI.
// Loads and live-watches a single markdown file under ~/.claude/plans/.

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
  const nameEl = $('popup-plan-name');
  const mtimeEl = $('popup-plan-mtime');
  const bodyEl = $('plan-body');
  const liveEl = $('plan-live-status');
  const btnSwitch = $('btn-switch-plan');
  const btnPin = $('btn-pin');
  const btnClose = $('btn-close');

  const pickerModal = $('picker-modal');
  const pickerList = $('picker-list');
  const pickerError = $('picker-error');
  const pickerLoading = $('picker-loading');
  const btnPickerCancel = $('btn-picker-cancel');
  const btnPickerClose = $('btn-picker-close');
  const btnPickerConfirm = $('btn-picker-confirm');

  const state = {
    currentPath: null,
    currentName: null,
    content: '',
    mtime: null,
    pickerOpen: false,
    pickerSelection: null,
    pickerPlans: [],
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

  function renderEmpty() {
    bodyEl.classList.add('empty');
    bodyEl.innerHTML = `
      <div class="plan-empty">
        <div class="big">No plan loaded</div>
        <div class="hint">Press <kbd>Plans</kbd> to pick a plan from ~/.claude/plans/</div>
      </div>
    `;
  }

  function renderMarkdown(md, preserveScroll) {
    const prevScrollRatio = preserveScroll && bodyEl.scrollHeight
      ? bodyEl.scrollTop / bodyEl.scrollHeight
      : null;
    const html = typeof window.marked !== 'undefined' && window.marked
      ? (window.marked.parse ? window.marked.parse(md) : window.marked(md))
      : '<pre>' + escapeHtml(md) + '</pre>';
    bodyEl.classList.remove('empty');
    bodyEl.innerHTML = '<div class="markdown-body"></div>';
    bodyEl.firstChild.innerHTML = html;
    if (prevScrollRatio != null) {
      requestAnimationFrame(() => {
        bodyEl.scrollTop = bodyEl.scrollHeight * prevScrollRatio;
      });
    } else {
      bodyEl.scrollTop = 0;
    }
  }

  function setHeaderFromState() {
    if (!state.currentPath) {
      nameEl.textContent = 'No plan loaded';
      mtimeEl.textContent = '';
      liveEl.innerHTML = '';
      return;
    }
    nameEl.textContent = state.currentName || state.currentPath;
    mtimeEl.textContent = state.mtime ? 'updated ' + formatRelativeTime(state.mtime) : '';
    liveEl.innerHTML = '<span class="plan-live-dot"></span><span>live</span>';
  }

  async function loadPlan(pathStr, name, scope) {
    state.currentPath = pathStr;
    state.currentName = name || (pathStr ? pathStr.split('/').pop() : null);
    state.currentScope = scope || 'local';
    try {
      const res = await api.planLoadPlan({ path: pathStr, scope: state.currentScope });
      if (!res || !res.success) {
        bodyEl.classList.add('empty');
        bodyEl.innerHTML = `<div class="plan-empty"><div class="big">Failed to load plan</div><div class="hint">${escapeHtml(res && res.error || 'unknown error')}</div></div>`;
        return;
      }
      state.content = res.content || '';
      state.mtime = res.mtime || null;
      setHeaderFromState();
      renderMarkdown(state.content, false);
      await api.planWatchPlan({ path: pathStr, scope: state.currentScope });
    } catch (e) {
      bodyEl.classList.add('empty');
      bodyEl.innerHTML = `<div class="plan-empty"><div class="big">Error</div><div class="hint">${escapeHtml(e.message || e)}</div></div>`;
    }
  }

  // Live updates
  api.onPlanUpdated((data) => {
    if (!data || !data.content) return;
    state.content = data.content;
    state.mtime = data.mtime || null;
    setHeaderFromState();
    renderMarkdown(state.content, true);
  });
  api.onPlanError((err) => {
    console.warn('[plan] error', err);
  });
  api.onPlanRemoved(() => {
    liveEl.innerHTML = '<span class="plan-live-dot stale"></span><span>file missing</span>';
  });
  api.onPlanTabSwitched(async (data) => {
    if (!data || !data.path) return;
    try { await api.planUnwatchPlan(); } catch (_) {}
    await loadPlan(data.path, data.name, data.scope);
  });
  api.onPlanNoBinding(() => {
    renderEmpty();
    if (!state.pickerOpen) openPicker();
  });

  // ── Picker ─────────────────────────────────────────────────────────────

  async function openPicker() {
    state.pickerOpen = true;
    state.pickerSelection = null;
    btnPickerConfirm.disabled = true;
    pickerError.classList.add('hidden');
    pickerLoading.classList.remove('hidden');
    pickerList.innerHTML = '';
    pickerModal.classList.remove('hidden');

    let res;
    try { res = await api.planListPlans(); }
    catch (e) {
      pickerLoading.classList.add('hidden');
      pickerError.textContent = 'Failed to list plans: ' + (e.message || e);
      pickerError.classList.remove('hidden');
      return;
    }
    pickerLoading.classList.add('hidden');
    if (!res || !res.success) {
      pickerError.textContent = res && res.error || 'Could not list plans.';
      pickerError.classList.remove('hidden');
      return;
    }
    state.pickerPlans = res.plans || [];
    state.pickerContext = res.context || null;
    applyHostBadge(state.pickerContext);
    if (!state.pickerPlans.length) {
      const host = (state.pickerContext && state.pickerContext.hostLabel) || 'local';
      const home = (state.pickerContext && state.pickerContext.remoteHome) || '~';
      pickerList.innerHTML = `<p class="picker-hint">No plans found in ${escapeHtml(host)}:${escapeHtml(home)}/.claude/plans/.</p>`;
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
    state.pickerPlans.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.dataset.path = p.path;
      item.dataset.idx = String(idx);
      const cwdBadge = p.cwdMatch ? '<span class="picker-item-badge">cwd</span>' : '';
      item.innerHTML = `
        <div class="picker-item-head">
          <span>${escapeHtml(p.slug || p.name)}${cwdBadge}</span>
          <span class="picker-item-time">${escapeHtml(formatRelativeTime(p.mtime))}</span>
        </div>
        ${p.heading ? `<div class="picker-item-heading">${escapeHtml(p.heading)}</div>` : ''}
        ${p.paragraph ? `<div class="picker-item-snippet">${escapeHtml(p.paragraph)}</div>` : ''}
      `;
      item.addEventListener('click', () => setPickerSelection(idx));
      item.addEventListener('dblclick', () => { setPickerSelection(idx); confirmPicker(); });
      pickerList.appendChild(item);
    });
    if (state.pickerPlans.length) setPickerSelection(0);
  }

  function setPickerSelection(idx) {
    if (!state.pickerPlans.length) return;
    const clamped = Math.max(0, Math.min(state.pickerPlans.length - 1, idx));
    state.pickerSelectionIdx = clamped;
    state.pickerSelection = state.pickerPlans[clamped];
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
    const p = state.pickerSelection;
    const scope = (state.pickerContext && state.pickerContext.scope) || 'local';
    closePicker();
    try { await api.planUnwatchPlan(); } catch (_) {}
    await loadPlan(p.path, p.slug || p.name, scope);
  }

  // ── Events ─────────────────────────────────────────────────────────────

  btnSwitch.addEventListener('click', openPicker);
  btnClose.addEventListener('click', () => api.planCloseWindow());
  btnPin.addEventListener('click', async () => {
    const pinned = await api.planTogglePin();
    btnPin.classList.toggle('active', !!pinned);
  });
  btnPickerCancel.addEventListener('click', closePicker);
  btnPickerClose.addEventListener('click', closePicker);
  btnPickerConfirm.addEventListener('click', confirmPicker);

  document.addEventListener('keydown', (e) => {
    if (state.pickerOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
      if (!state.pickerPlans.length) return;
      const cur = state.pickerSelectionIdx == null ? -1 : state.pickerSelectionIdx;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setPickerSelection(cur + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setPickerSelection(cur - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setPickerSelection(0); }
      else if (e.key === 'End') { e.preventDefault(); setPickerSelection(state.pickerPlans.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); confirmPicker(); }
      return;
    }
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    if (typing) return;
    if (e.key === 'Escape') { e.preventDefault(); api.planCloseWindow(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); bodyEl.scrollBy({ top: -160 }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bodyEl.scrollBy({ top: 160 }); }
    else if (e.key === 'PageUp') { e.preventDefault(); bodyEl.scrollBy({ top: -bodyEl.clientHeight * 0.9 }); }
    else if (e.key === 'PageDown') { e.preventDefault(); bodyEl.scrollBy({ top: bodyEl.clientHeight * 0.9 }); }
    else if (e.key === 'Home') { e.preventDefault(); bodyEl.scrollTo({ top: 0 }); }
    else if (e.key === 'End') { e.preventDefault(); bodyEl.scrollTo({ top: bodyEl.scrollHeight }); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPicker(); }
  }, true);

  // Boot: restore last plan if any.
  async function boot() {
    try {
      const res = await api.planGetCurrent();
      if (res && res.success && res.path) {
        await loadPlan(res.path, res.name, res.scope);
      } else {
        renderEmpty();
        setTimeout(openPicker, 150);
      }
    } catch (_) {
      renderEmpty();
    }
  }

  boot();
})();
