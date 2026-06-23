/* global marked, mermaid, katex, document, window, setTimeout */

// Shared Markdown render pipeline — used by both the main-window Reader (app.js)
// and the Open-File-by-Path viewer popup (file-viewer-renderer.js).
//
// Exposed as the browser global `window.MadMarkdownRender`. Call init(config)
// once before rendering. config injects the dependencies that used to be
// closure state in app.js:
//   getStripFrontMatter() -> bool      (was `_stripFrontMatter`)
//   getTheme()            -> string    (was `themeSelect.value`)
//   thresholds            -> { progressive, virtual }
//   renderMindmapVizBlocks(el)|null    (was app.js renderMindmapVizBlocks; popup omits)

(function () {
  'use strict';

  let _config = {
    getStripFrontMatter: () => true,
    getTheme: () => 'dark',
    thresholds: { progressive: 1 * 1024 * 1024, virtual: 5 * 1024 * 1024 },
    renderMindmapVizBlocks: null,
  };

  let mermaidRenderCounter = 0;

  // loadScript — VERBATIM from app.js
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  let _mermaidReady = false;
  async function ensureMermaid() {
    if (_mermaidReady) return;
    await loadScript('./node_modules/mermaid/dist/mermaid.min.js');
    mermaid.initialize({
      startOnLoad: false,
      theme: _config.getTheme(),
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
    _mermaidReady = true;
  }

  let _katexReady = false;
  async function ensureKatex() {
    if (_katexReady) return;
    await loadScript('./node_modules/katex/dist/katex.min.js');
    _katexReady = true;
  }

  // KaTeX's auto-render extension renders math by walking the DOM (text nodes),
  // where HTML entities (&lt; etc.) are already decoded — unlike string-based
  // extraction over raw HTML, which would feed KaTeX broken `\prod_{i&lt;j}`.
  let _autoRenderReady = false;
  async function ensureKatexAutoRender() {
    await ensureKatex();
    if (_autoRenderReady) return;
    await loadScript('./node_modules/katex/dist/contrib/auto-render.min.js');
    _autoRenderReady = true;
  }

  // markedRenderer setup — runs in init() once `marked` global exists.
  let markedRenderer = null;
  function configureMarked() {
    markedRenderer = new marked.Renderer();
    markedRenderer.code = function (token) {
      const text = typeof token?.text === 'string' ? token.text : '';
      const lang = typeof token?.lang === 'string' ? token.lang : '';
      if (lang === 'mermaid') {
        mermaidRenderCounter++;
        const containerId = `md-mermaid-${mermaidRenderCounter}`;
        return `<div class="mermaid-block" data-mermaid-id="${containerId}" data-mermaid-src="${encodeURIComponent(text)}"></div>`;
      }
      if (lang === 'mindmap-viz') {
        return `<div class="mindmap-viz-block" data-viz-json="${encodeURIComponent(text)}"></div>`;
      }
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langClass}>${escaped}</code></pre>`;
    };
    marked.setOptions({
      gfm: true,
      breaks: false,
      renderer: markedRenderer,
    });
  }

  function extractMath(markdown) {
    const blocks = []; // { placeholder, src, display }
    let id = 0;
    const ph = () => `MATHPH${id++}ENDMATHPH`;

    // First, protect fenced code blocks and inline code spans so we don't
    // touch math-like syntax inside them.
    const codeSpans = [];
    let safe = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
      const idx = codeSpans.length;
      codeSpans.push(m);
      return `CODEPH${idx}ENDCODEPH`;
    });

    // Display math (order matters — match multi-char delimiters first)
    // $$...$$
    safe = safe.replace(/\$\$([\s\S]+?)\$\$/g, (_m, src) => {
      const p = ph();
      blocks.push({ placeholder: p, src, display: true });
      return p;
    });
    // \[...\]
    safe = safe.replace(/\\\[([\s\S]+?)\\\]/g, (_m, src) => {
      const p = ph();
      blocks.push({ placeholder: p, src, display: true });
      return p;
    });

    // Inline math
    // \(...\)
    safe = safe.replace(/\\\(([\s\S]+?)\\\)/g, (_m, src) => {
      const p = ph();
      blocks.push({ placeholder: p, src, display: false });
      return p;
    });
    // $...$  (single line, not preceded/followed by $)
    safe = safe.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_m, src) => {
      const p = ph();
      blocks.push({ placeholder: p, src, display: false });
      return p;
    });

    // Restore code spans / fences
    safe = safe.replace(/CODEPH(\d+)ENDCODEPH/g, (_m, idx) => codeSpans[+idx]);

    return { cleaned: safe, blocks };
  }

  function restoreMath(html, blocks) {
    if (!blocks.length) return html;
    for (const b of blocks) {
      const rendered = renderMathBlock(b.src, b.display);
      html = html.replace(b.placeholder, rendered);
    }
    return html;
  }

  function renderMathBlock(src, display) {
    try {
      return katex.renderToString(src, {
        displayMode: display,
        throwOnError: false,
        output: 'html',
      });
    } catch (_e) {
      const escaped = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<code class="katex-error">${escaped}</code>`;
    }
  }

  async function renderMermaidBlocks(container) {
    const blocks = container.querySelectorAll('.mermaid-block');
    for (const block of blocks) {
      const src = decodeURIComponent(block.dataset.mermaidSrc);
      const id = block.dataset.mermaidId;
      try {
        const { svg } = await mermaid.render(id, src);
        block.innerHTML = svg;
        block.classList.add('mermaid-block-rendered');
      } catch (err) {
        block.innerHTML = `<pre class="mermaid-error">Mermaid error: ${err.message || err}</pre>`;
        const badEl = document.getElementById(id);
        if (badEl) badEl.remove();
      }
    }
  }

  function maybeStripFrontMatter(content) {
    if (!_config.getStripFrontMatter()) return content;
    // YAML front matter (--- ... ---)
    let m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (m) return content.slice(m[0].length);
    // TOML front matter (+++ ... +++)
    m = content.match(/^\+\+\+\r?\n[\s\S]*?\r?\n\+\+\+\r?\n?/);
    if (m) return content.slice(m[0].length);
    return content;
  }

  async function renderMarkdownProgressive(content, targetEl) {
    targetEl.innerHTML = '';
    mermaidRenderCounter = 0;

    const stripped = maybeStripFrontMatter(content);
    const { cleaned, blocks: mathBlocks } = extractMath(stripped);
    if (mathBlocks.length) await ensureKatex();

    // Split at double-newline (paragraph/block boundaries)
    const blocks = cleaned.split(/\n{2,}/);
    const BATCH_SIZE = 20;

    // First batch: render immediately for fast first paint
    const firstBatch = blocks.slice(0, BATCH_SIZE).join('\n\n');
    let firstHtml = marked.parse(firstBatch);
    firstHtml = restoreMath(firstHtml, mathBlocks);
    targetEl.innerHTML = firstHtml;

    // Remaining batches via requestIdleCallback
    let offset = BATCH_SIZE;
    while (offset < blocks.length) {
      await new Promise((resolve) => {
        (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(resolve);
      });

      const batch = blocks.slice(offset, offset + BATCH_SIZE).join('\n\n');
      let batchHtml = marked.parse(batch);
      batchHtml = restoreMath(batchHtml, mathBlocks);
      const fragment = document.createElement('div');
      fragment.innerHTML = batchHtml;

      while (fragment.firstChild) {
        targetEl.appendChild(fragment.firstChild);
      }
      offset += BATCH_SIZE;
    }

    // Render Mermaid blocks only for files under 5MB
    if (content.length < _config.thresholds.virtual) {
      await ensureMermaid();
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      });
      await renderMermaidBlocks(targetEl);
    }
    if (_config.renderMindmapVizBlocks) _config.renderMindmapVizBlocks(targetEl);
  }

  async function renderMarkdown(content, targetEl) {
    if (content && content.length > _config.thresholds.progressive) {
      return renderMarkdownProgressive(content, targetEl);
    }

    mermaidRenderCounter = 0;

    await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const stripped = maybeStripFrontMatter(content);
    const { cleaned, blocks: mathBlocks } = extractMath(stripped);
    if (mathBlocks.length) await ensureKatex();
    let html = marked.parse(cleaned);
    html = restoreMath(html, mathBlocks);

    const renderTarget = document.createElement('div');
    renderTarget.innerHTML = html;

    await renderMermaidBlocks(renderTarget);
    targetEl.innerHTML = renderTarget.innerHTML;
    if (_config.renderMindmapVizBlocks) _config.renderMindmapVizBlocks(targetEl);
  }

  function renderPlainText(content, targetEl) {
    if (!content) {
      targetEl.innerHTML = '<pre class="reader-plaintext"><code>(empty file)</code></pre>';
      return;
    }
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    targetEl.innerHTML = '<pre class="reader-plaintext"><code>' + escaped + '</code></pre>';
  }

  // Render mermaid diagrams written the HTML way (not markdown fences):
  // <pre class="mermaid">…</pre>, <div class="mermaid">…</div>, or
  // <code class="language-mermaid">…</code>. Each is replaced in-place by its SVG.
  async function renderHtmlMermaid(container) {
    const nodes = container.querySelectorAll(
      'pre.mermaid, div.mermaid, code.language-mermaid, pre > code.language-mermaid',
    );
    if (!nodes.length) return;
    await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      theme: _config.getTheme(),
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
    let i = 0;
    for (const node of nodes) {
      // For <code class=language-mermaid> replace the enclosing <pre> if present.
      const target = (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE')
        ? node.parentElement : node;
      const src = node.textContent || '';
      if (!src.trim()) continue;
      try {
        const { svg } = await mermaid.render('viewer-mermaid-' + (i++), src);
        const wrap = document.createElement('div');
        wrap.className = 'mermaid-block mermaid-block-rendered';
        wrap.innerHTML = svg;
        target.replaceWith(wrap);
      } catch (err) {
        const pre = document.createElement('pre');
        pre.className = 'mermaid-error';
        pre.textContent = 'Mermaid error: ' + (err && err.message ? err.message : err);
        target.replaceWith(pre);
      }
    }
  }

  // Render an already-HTML document INTO a target element, then apply rich
  // rendering by walking the live DOM: KaTeX math (auto-render — entity-safe,
  // unlike string extraction over raw HTML) and HTML-style mermaid diagrams.
  // Used by the file-viewer's "Rendered" mode for .html files.
  async function renderHtmlInto(targetEl, html) {
    targetEl.innerHTML = html || '';
    // Math: render in place over the DOM (handles $…$, $$…$$, \(…\), \[…\]).
    await ensureKatexAutoRender();
    try {
      window.renderMathInElement(targetEl, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      });
    } catch (_) { /* auto-render best-effort */ }
    // Diagrams: mermaid blocks if any.
    try { await renderHtmlMermaid(targetEl); } catch (_) { /* best-effort */ }
  }

  function init(config) {
    _config = Object.assign({}, _config, config || {});
    if (typeof marked !== 'undefined' && marked) configureMarked();
  }

  window.MadMarkdownRender = {
    init, renderMarkdown, renderMarkdownProgressive, renderPlainText,
    extractMath, restoreMath, renderMathBlock, renderMermaidBlocks, maybeStripFrontMatter,
    renderHtmlInto,
  };
})();
