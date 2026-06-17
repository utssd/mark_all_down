// Renderer for the Open-File-by-Path prompt window. A small always-on-top dialog
// that collects a path + source and asks main to open the file viewer. Talks to
// main only via window.promptAPI. On success, main closes this window.

(function () {
  'use strict';

  const api = window.promptAPI;
  const inputEl = document.getElementById('prompt-input');
  const autoLabelEl = document.getElementById('prompt-auto-label');
  const errorEl = document.getElementById('prompt-error');
  const btnOpen = document.getElementById('btn-prompt-open');
  const btnCancel = document.getElementById('btn-prompt-cancel');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }
  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function selectedSource() {
    const checked = document.querySelector('input[name="prompt-source"]:checked');
    return (checked && checked.value) || 'auto';
  }

  async function submit() {
    const path = inputEl.value.trim();
    if (!path) { showError('Enter a file path.'); inputEl.focus(); return; }
    clearError();
    btnOpen.disabled = true;
    try {
      const res = await api.submit({ path, source: selectedSource() });
      if (!res || !res.success) {
        showError((res && res.error) || 'Failed to open file.');
      }
      // On success, main closes this window — nothing else to do here.
    } catch (err) {
      showError(err && err.message ? err.message : String(err));
    } finally {
      btnOpen.disabled = false;
    }
  }

  async function boot() {
    inputEl.focus();
    try {
      const ctx = await api.detect();
      if (ctx && ctx.scope === 'remote') {
        autoLabelEl.textContent = `Auto: ${ctx.hostLabel}`;
      } else if (ctx && ctx.cwd) {
        autoLabelEl.textContent = `Auto: local ${ctx.cwd}`;
      } else {
        autoLabelEl.textContent = 'Auto: local';
      }
    } catch (_) {
      autoLabelEl.textContent = 'Auto: local';
    }
  }

  btnOpen.addEventListener('click', submit);
  btnCancel.addEventListener('click', () => { api.cancel(); });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); api.cancel(); }
  });

  boot();
})();
