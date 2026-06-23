// Renderer for the File Viewer popup. Pulls resolved content from the main
// process, renders it via the shared MadMarkdownRender module, and wires the
// header actions (reopen / pin / close). Talks to main only via popupAPI.

(function () {
  'use strict';

  const api = window.popupAPI;
  const bodyEl = document.getElementById('viewer-body');
  const titleEl = document.getElementById('viewer-title');
  const hostEl = document.getElementById('viewer-host');
  const btnReopen = document.getElementById('btn-viewer-reopen');
  const btnPin = document.getElementById('btn-viewer-pin');
  const btnLatex = document.getElementById('btn-viewer-latex');

  let _stripFrontMatter = true;
  let _currentPayload = null;
  let _htmlRenderMode = 'raw'; // 'raw' = sandboxed iframe, 'rendered' = inline + LaTeX

  // Strip executable bits before injecting file HTML into THIS document (the
  // "rendered" mode runs unsandboxed so KaTeX CSS applies). Removes <script>
  // blocks and inline on*= handlers. The popup has nodeIntegration:false +
  // contextIsolation:true, so page content can't reach Node/IPC regardless.
  function sanitizeHtml(html) {
    return String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<script\b[^>]*\/?>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  }

  // Reset body classes between renders (markdown vs media/iframe need different layout).
  function resetBody() {
    bodyEl.classList.remove('empty', 'viewer-media');
    bodyEl.classList.add('markdown-body');
    bodyEl.innerHTML = '';
  }

  function showError(msg) {
    bodyEl.classList.remove('markdown-body', 'viewer-media');
    bodyEl.classList.add('empty');
    bodyEl.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'viewer-error';
    div.textContent = msg;
    bodyEl.appendChild(div);
  }

  // HTML has two views: 'raw' (sandboxed iframe, safe default) and 'rendered'
  // (sanitized HTML in the reader pane with scripts applied — KaTeX math +
  // mermaid). The "Render scripts" button toggles between them.
  function updateLatexBtn() {
    btnLatex.textContent = _htmlRenderMode === 'rendered' ? '⌫ Raw HTML' : '∑ Render scripts';
    btnLatex.title = _htmlRenderMode === 'rendered'
      ? 'Show the raw HTML in a sandboxed view'
      : 'Render the HTML with scripts applied (LaTeX math + Mermaid diagrams)';
  }

  async function renderHtml(content) {
    if (_htmlRenderMode === 'rendered') {
      // Rendered: the file's HTML is isolated in a Shadow DOM (its CSS can't leak
      // out and restyle the popup chrome) and rich-rendered in place — KaTeX math
      // (auto-render over the DOM, so entity-encoded `<` works) and mermaid. KaTeX
      // CSS is linked INTO the shadow root (same-origin → fonts load). The doc is
      // given a plain white background + black text — i.e. how it would look in a
      // default browser — and the file's own CSS still overrides that.
      bodyEl.classList.remove('markdown-body', 'viewer-media', 'empty');
      bodyEl.innerHTML = '';
      const safe = sanitizeHtml(content || '');
      const host = document.createElement('div');
      host.className = 'viewer-html-host';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML =
        '<link rel="stylesheet" href="./node_modules/katex/dist/katex.min.css">' +
        '<style>:host{display:block;}' +
        '.viewer-html-doc{background:#fff;color:#000;padding:20px 28px;min-height:100%;box-sizing:border-box;}</style>' +
        '<div class="viewer-html-doc"></div>';
      bodyEl.appendChild(host);
      await window.MadMarkdownRender.renderHtmlInto(shadow.querySelector('.viewer-html-doc'), safe);
    } else {
      // Raw: sandboxed iframe, no script execution, no math. The file renders with
      // its own styling (no theme injected).
      bodyEl.classList.remove('empty', 'markdown-body');
      bodyEl.classList.add('viewer-media');
      const iframe = document.createElement('iframe');
      iframe.className = 'viewer-html';
      iframe.setAttribute('sandbox', '');
      iframe.setAttribute('srcdoc', content || '');
      bodyEl.innerHTML = '';
      bodyEl.appendChild(iframe);
    }
    updateLatexBtn();
  }

  async function render(payload) {
    _currentPayload = payload || null;
    if (!payload) { showError('No file loaded.'); return; }
    titleEl.textContent = payload.fileName || payload.path || 'File Viewer';
    document.title = (payload.fileName || 'File') + ' — File Viewer';
    if (payload.hostLabel && payload.hostLabel !== 'local') {
      hostEl.textContent = payload.hostLabel; hostEl.hidden = false;
    } else {
      hostEl.hidden = true;
    }
    // The LaTeX toggle only applies to HTML files.
    btnLatex.hidden = payload.fileType !== 'html';
    try {
      if (payload.fileType === 'image') {
        // Base64 data URI — no markdown-body padding, centered.
        bodyEl.classList.remove('empty', 'markdown-body');
        bodyEl.classList.add('viewer-media');
        const src = `data:${payload.mimeType || 'application/octet-stream'};base64,${payload.content || ''}`;
        const img = document.createElement('img');
        img.className = 'viewer-image';
        img.src = src;
        img.alt = payload.fileName || '';
        bodyEl.innerHTML = '';
        bodyEl.appendChild(img);
      } else if (payload.fileType === 'html') {
        _htmlRenderMode = 'raw'; // each new file starts in the safe raw view
        await renderHtml(payload.content || '');
      } else if (payload.fileType === 'markdown') {
        resetBody();
        await window.MadMarkdownRender.renderMarkdown(payload.content || '', bodyEl);
      } else {
        resetBody();
        window.MadMarkdownRender.renderPlainText(payload.content || '', bodyEl);
      }
    } catch (err) {
      showError('Failed to render: ' + (err && err.message ? err.message : String(err)));
    }
  }

  async function boot() {
    try {
      const s = await api.loadSettings();
      _stripFrontMatter = (s && s.general && typeof s.general.stripFrontMatter === 'boolean')
        ? s.general.stripFrontMatter : true;
    } catch (_) {}

    window.MadMarkdownRender.init({
      getStripFrontMatter: () => _stripFrontMatter,
      getTheme: () => 'dark',
      thresholds: { progressive: 1 * 1024 * 1024, virtual: 5 * 1024 * 1024 },
      renderMindmapVizBlocks: null,
    });

    const payload = await api.viewerGetContent();
    await render(payload);
  }

  async function togglePin() {
    const res = await api.viewerTogglePin();
    btnPin.textContent = res && res.pinned ? 'Pinned (p)' : 'Pin (p)';
  }

  btnReopen.addEventListener('click', () => { api.viewerReopen(); });
  btnPin.addEventListener('click', togglePin);
  btnLatex.addEventListener('click', async () => {
    if (!_currentPayload || _currentPayload.fileType !== 'html') return;
    _htmlRenderMode = _htmlRenderMode === 'rendered' ? 'raw' : 'rendered';
    try {
      await renderHtml(_currentPayload.content || '');
    } catch (err) {
      showError('Failed to render: ' + (err && err.message ? err.message : String(err)));
    }
  });

  // Shortcut keys arrive from the main process via 'viewer:key' (captured with
  // before-input-event), so they work even when the HTML <iframe> has focus —
  // a plain document keydown listener here would be swallowed by the iframe.
  // Scroll keys move the content pane (#viewer-body is the scroll container);
  // o = open another, p = pin, Esc = close.
  function handleKey(key) {
    switch (key) {
      case 'ArrowUp': bodyEl.scrollBy({ top: -160 }); break;
      case 'ArrowDown': bodyEl.scrollBy({ top: 160 }); break;
      case 'PageUp': bodyEl.scrollBy({ top: -bodyEl.clientHeight * 0.9 }); break;
      case 'PageDown': case ' ': bodyEl.scrollBy({ top: bodyEl.clientHeight * 0.9 }); break;
      case 'Home': bodyEl.scrollTo({ top: 0 }); break;
      case 'End': bodyEl.scrollTo({ top: bodyEl.scrollHeight }); break;
      case 'o': case 'O': api.viewerReopen(); break;
      case 'p': case 'P': togglePin(); break;
      case 'Escape': api.viewerCloseWindow(); break;
      default: break;
    }
  }
  api.onViewerKey(({ key }) => handleKey(key));

  api.onViewerContent((payload) => { render(payload); });

  boot();
})();
