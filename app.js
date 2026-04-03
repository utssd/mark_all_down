(function () {
  'use strict';

  // ── Lazy script loading ──

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  let _stripFrontMatter = true;

  let _mermaidReady = false;
  async function ensureMermaid() {
    if (_mermaidReady) return;
    await loadScript('./node_modules/mermaid/dist/mermaid.min.js');
    mermaid.initialize({
      startOnLoad: false,
      theme: themeSelect.value,
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

  // ── Sample diagrams ──

  const samples = {
    flowchart: `graph TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[Car]`,

    sequence: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`,

    class: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
    class Zebra{
        +bool is_wild
        +run()
    }`,

    er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
    CUSTOMER {
        string name
        string custNumber
        string sector
    }
    ORDER {
        int orderNumber
        string deliveryAddress
    }
    LINE-ITEM {
        string productCode
        int quantity
        float pricePerUnit
    }`,

    state: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,

    gantt: `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
        A task          :a1, 2024-01-01, 30d
        Another task    :after a1, 20d
    section Another
        Task in Another :2024-01-12, 12d
        another task    :24d`,

    pie: `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`,

    mindmap: `mindmap
  root((mindmap))
    Origins
      Long history
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness
      On features
      On creation
    Tools
      Pen and paper
      Mermaid`,

    timeline: `timeline
    title History of Social Media Platform
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : Youtube
    2006 : Twitter`,

    gitgraph: `gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit
    commit`,
  };

  // ── Sample LaTeX equations ──

  const latexSamples = {
    quadratic: `x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`,

    euler: `e^{i\\pi} + 1 = 0`,

    matrix: `\\begin{pmatrix}
a & b & c \\\\
d & e & f \\\\
g & h & i
\\end{pmatrix}
\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}
=
\\begin{pmatrix} 1 \\\\ 2 \\\\ 3 \\end{pmatrix}`,

    integral: `\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}`,

    sum: `\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}`,

    maxwell: `\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\[6pt]
\\nabla \\cdot \\mathbf{B} &= 0 \\\\[6pt]
\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\[6pt]
\\nabla \\times \\mathbf{B} &= \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
\\end{aligned}`,

    schrodinger: `i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\left[ -\\frac{\\hbar^2}{2m} \\nabla^2 + V(\\mathbf{r}, t) \\right] \\Psi(\\mathbf{r}, t)`,

    trig: `\\begin{aligned}
\\sin^2\\theta + \\cos^2\\theta &= 1 \\\\[6pt]
\\sin(\\alpha \\pm \\beta) &= \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta \\\\[6pt]
\\cos(\\alpha \\pm \\beta) &= \\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta
\\end{aligned}`,
  };

  // ── State ──

  let editor;
  let latexEditor;
  let mdEditor;
  let currentZoom = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let renderCounter = 0;
  let currentMode = 'reader';
  let mermaidRenderCounter = 0;

  let latexZoom = 1;
  let latexPanX = 0;
  let latexPanY = 0;
  let isLatexPanning = false;
  let latexPanStartX = 0;
  let latexPanStartY = 0;

  let tabIdCounter = 0;
  let readerTabs = [];
  let activeReaderTabId = null;
  let mdEditorTabs = [];
  let activeMdEditorTabId = null;

  // ── DOM refs ──

  const previewEl = document.getElementById('preview');
  const previewViewport = document.getElementById('preview-viewport');
  const errorBar = document.getElementById('error-bar');
  const themeSelect = document.getElementById('diagram-theme');
  const btnDownloadSVG = document.getElementById('btn-download-svg');
  const btnDownloadPNG = document.getElementById('btn-download-png');
  const filenameInput = document.getElementById('filename-input');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');

  const modeTabs = document.querySelectorAll('.mode-tab');
  const mermaidOnlyEls = document.querySelectorAll('.mermaid-mode-only');
  const readerOnlyEls = document.querySelectorAll('.reader-mode-only');
  const latexOnlyEls = document.querySelectorAll('.latex-mode-only');
  const btnOpenFile = document.getElementById('btn-open-file');
  const markdownBody = document.getElementById('markdown-body');
  const readerTabBar = document.getElementById('reader-tab-bar');
  const readerView = document.getElementById('reader-view');
  const readerScrollContainer = readerView.querySelector('.reader-container');

  const latexPreviewEl = document.getElementById('latex-preview');
  const latexPreviewViewport = document.getElementById('latex-preview-viewport');
  const latexErrorBar = document.getElementById('latex-error-bar');
  const latexFilenameInput = document.getElementById('latex-filename-input');
  const btnLatexDownloadPNG = document.getElementById('btn-latex-download-png');
  const btnLatexZoomIn = document.getElementById('btn-latex-zoom-in');
  const btnLatexZoomOut = document.getElementById('btn-latex-zoom-out');
  const btnLatexZoomReset = document.getElementById('btn-latex-zoom-reset');

  const mdEditorOnlyEls = document.querySelectorAll('.md-editor-mode-only');
  const pagesOnlyEls = document.querySelectorAll('.pages-mode-only');
  const mdEditorPreviewEl = document.getElementById('md-editor-preview');
  const btnMdEditorDownloadHTML = document.getElementById('btn-md-editor-download-html');
  const mdEditorTabBar = document.getElementById('md-editor-tab-bar');
  const btnSaveMdEditor = document.getElementById('btn-save-md-editor');
  const btnMdEditorNewTab = document.getElementById('btn-md-editor-new-tab');
  const btnMdEditorOpenFile = document.getElementById('btn-md-editor-open-file');

  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const btnSettingsCancel = document.getElementById('btn-settings-cancel');
  const btnSettingsSave = document.getElementById('btn-settings-save');
  const settingSshHost = document.getElementById('setting-ssh-host');
  const settingSshUser = document.getElementById('setting-ssh-user');
  const settingSshPort = document.getElementById('setting-ssh-port');
  const settingRemotePath = document.getElementById('setting-remote-path');
  const sshKeyStatus = document.getElementById('ssh-key-status');
  const settingSshPassword = document.getElementById('setting-ssh-password');
  const btnSshSetupKey = document.getElementById('btn-ssh-setup-key');
  const btnSshTest = document.getElementById('btn-ssh-test');
  const sshTestResult = document.getElementById('ssh-test-result');

  const btnSyncMdEditor = document.getElementById('btn-sync-md-editor');
  const btnOpenFromSsh = document.getElementById('btn-open-from-ssh');
  const btnOpenFromSshMermaid = document.getElementById('btn-open-from-ssh-mermaid');
  const btnOpenFromSshLatex = document.getElementById('btn-open-from-ssh-latex');
  const btnOpenFromSshMdEditor = document.getElementById('btn-open-from-ssh-md-editor');

  // Pages mode
  const pagesBody = document.getElementById('pages-body');
  const pagesLoading = document.getElementById('pages-loading');
  const pagesEmptyState = document.getElementById('pages-empty-state');
  const pagesContentWrap = document.getElementById('pages-content-wrap');
  const btnPagesBack = document.getElementById('btn-pages-back');
  const btnPagesForward = document.getElementById('btn-pages-forward');
  const btnPagesRefresh = document.getElementById('btn-pages-refresh');
  const pagesBreadcrumb = document.getElementById('pages-breadcrumb');
  const pagesSidebar = document.getElementById('pages-sidebar');
  const pagesSidebarTitle = document.getElementById('pages-sidebar-title');
  const pagesSidebarSearch = document.getElementById('pages-sidebar-search');
  const pagesFileTree = document.getElementById('pages-file-tree');
  const btnPagesSidebarToggle = document.getElementById('btn-pages-sidebar-toggle');
  const pagesIndexView = document.getElementById('pages-index-view');
  const pagesIndexGrid = document.getElementById('pages-index-grid');
  const pagesIndexHeading = document.getElementById('pages-index-heading');

  // General settings
  const generalStripFrontMatterEl = document.getElementById('general-strip-front-matter');

  // Pages settings
  const pagesSourceLocal = document.getElementById('pages-source-local');
  const pagesSourceSsh = document.getElementById('pages-source-ssh');
  const settingPagesLocalPath = document.getElementById('setting-pages-local-path');
  const settingPagesRemotePath = document.getElementById('setting-pages-remote-path');
  const pagesLocalPathRow = document.getElementById('pages-local-path-row');
  const pagesRemotePathRow = document.getElementById('pages-remote-path-row');
  const pagesSshHint = document.getElementById('pages-ssh-hint');

  const openFromSshModal = document.getElementById('open-from-ssh-modal');
  const btnOpenFromSshClose = document.getElementById('btn-open-from-ssh-close');
  const btnOpenFromSshCancel = document.getElementById('btn-open-from-ssh-cancel');
  const btnOpenFromSshOpen = document.getElementById('btn-open-from-ssh-open');
  const openFromSshError = document.getElementById('open-from-ssh-error');
  const openFromSshLoading = document.getElementById('open-from-ssh-loading');
  const openFromSshListWrap = document.getElementById('open-from-ssh-list-wrap');
  const openFromSshList = document.getElementById('open-from-ssh-list');
  const openFromSshPath = document.getElementById('open-from-ssh-path');

  const passwordModal = document.getElementById('password-modal');
  const btnPasswordClose = document.getElementById('btn-password-close');
  const btnPasswordCancel = document.getElementById('btn-password-cancel');
  const btnPasswordConfirm = document.getElementById('btn-password-confirm');
  const syncPasswordInput = document.getElementById('sync-password-input');
  const statusToast = document.getElementById('status-toast');

  const findBar = document.getElementById('find-bar');
  const findInput = document.getElementById('find-input');
  const findCaseSensitive = document.getElementById('find-case-sensitive');
  const findMatchCount = document.getElementById('find-match-count');
  const btnFindPrev = document.getElementById('btn-find-prev');
  const btnFindNext = document.getElementById('btn-find-next');
  const btnFindClose = document.getElementById('btn-find-close');

  // ── Mode switching ──

  function switchMode(mode) {
    currentMode = mode;

    modeTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    mermaidOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'mermaid');
    });

    readerOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'reader');
    });

    latexOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'latex');
    });

    mdEditorOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'md-editor');
    });

    pagesOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'pages');
    });

    if (mode === 'pages' && !_pagesInitialized) {
      pagesInit();
    }

    if (mode === 'mermaid') {
      renderDiagram();
    }
    if (mode === 'latex') {
      if (latexEditor) latexEditor.refresh();
      renderLatex();
    }
    if (mode === 'md-editor' && mdEditor) {
      mdEditor.refresh();
    }
  }

  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // ── Init CodeMirror ──

  editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    mode: 'markdown',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentWithTabs: false,
    autofocus: true,
  });

  // ── Rendering ──

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  async function renderDiagram() {
    const code = editor.getValue().trim();
    if (!code) {
      previewEl.innerHTML =
        '<p style="color:var(--text-muted)">Enter Mermaid code on the left to see a preview</p>';
      hideError();
      return;
    }

    await ensureMermaid();
    renderCounter++;
    const id = `mermaid-svg-${renderCounter}`;

    try {
      const { svg } = await mermaid.render(id, code);
      previewEl.innerHTML = svg;
      hideError();
    } catch (err) {
      showError(err.message || String(err));
      const badEl = document.getElementById(id);
      if (badEl) badEl.remove();
    }
  }

  function showError(msg) {
    errorBar.textContent = msg;
    errorBar.classList.remove('hidden');
  }

  function hideError() {
    errorBar.textContent = '';
    errorBar.classList.add('hidden');
  }

  const debouncedRender = debounce(renderDiagram, 300);

  editor.on('change', debouncedRender);

  // ── Theme change ──

  themeSelect.addEventListener('change', () => {
    if (_mermaidReady) {
      mermaid.initialize({
        startOnLoad: false,
        theme: themeSelect.value,
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      });
    }
    renderDiagram();
  });

  // ── Filename helper ──

  function getFilename(ext) {
    const name = filenameInput.value.trim();
    if (name) return `${name}.${ext}`;
    return `mermaid-diagram.${ext}`;
  }

  // ── Download SVG ──

  btnDownloadSVG.addEventListener('click', () => {
    const svgEl = previewEl.querySelector('svg');
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgEl);

    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, getFilename('svg'));
  });

  // ── Download PNG ──

  btnDownloadPNG.addEventListener('click', () => {
    const svgEl = previewEl.querySelector('svg');
    if (!svgEl) return;

    const scale = 2;
    const clone = svgEl.cloneNode(true);

    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    const bbox = svgEl.getBBox();
    const vb = svgEl.getAttribute('viewBox');
    let width, height;

    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      width = parts[2];
      height = parts[3];
    } else {
      width = bbox.width || svgEl.getBoundingClientRect().width;
      height = bbox.height || svgEl.getBoundingClientRect().height;
    }

    clone.setAttribute('width', width);
    clone.setAttribute('height', height);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    const canvasW = width * scale;
    const canvasH = height * scale;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, getFilename('png'));
      }, 'image/png');
    };

    img.onerror = () => {
      showError('Failed to export PNG. Try downloading SVG instead.');
    };

    img.src = dataUri;
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Zoom & Pan ──

  function applyTransform() {
    previewEl.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  }

  btnZoomIn.addEventListener('click', () => {
    currentZoom = Math.min(currentZoom * 1.25, 5);
    applyTransform();
  });

  btnZoomOut.addEventListener('click', () => {
    currentZoom = Math.max(currentZoom / 1.25, 0.1);
    applyTransform();
  });

  btnZoomReset.addEventListener('click', () => {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  });

  previewViewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      currentZoom = Math.min(Math.max(currentZoom * delta, 0.1), 5);
      applyTransform();
    },
    { passive: false }
  );

  previewViewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
  });

  // ── Sample chips ──

  document.querySelectorAll('.chip[data-sample]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.sample;
      if (samples[key]) {
        document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        editor.setValue(samples[key]);
        resetView();
      }
    });
  });

  function resetView() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  // ════════════════════════════════════════════
  //  LaTeX Editor
  // ════════════════════════════════════════════

  // ── Init LaTeX CodeMirror ──

  latexEditor = CodeMirror.fromTextArea(document.getElementById('latex-editor'), {
    mode: 'stex',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentWithTabs: false,
  });

  // ── LaTeX rendering ──

  async function renderLatex() {
    await ensureKatex();
    const code = latexEditor.getValue().trim();
    if (!code) {
      latexPreviewEl.innerHTML =
        '<p style="color:var(--text-muted)">Enter LaTeX code on the left to see a preview</p>';
      hideLatexError();
      return;
    }

    try {
      const html = katex.renderToString(code, {
        displayMode: true,
        throwOnError: true,
        output: 'htmlAndMathml',
      });
      latexPreviewEl.innerHTML = html;
      hideLatexError();
    } catch (err) {
      showLatexError(err.message || String(err));
    }
  }

  function showLatexError(msg) {
    latexErrorBar.textContent = msg;
    latexErrorBar.classList.remove('hidden');
  }

  function hideLatexError() {
    latexErrorBar.textContent = '';
    latexErrorBar.classList.add('hidden');
  }

  const debouncedLatexRender = debounce(renderLatex, 300);

  latexEditor.on('change', debouncedLatexRender);

  // ── LaTeX Zoom & Pan ──

  function applyLatexTransform() {
    latexPreviewEl.style.transform = `translate(${latexPanX}px, ${latexPanY}px) scale(${latexZoom})`;
  }

  btnLatexZoomIn.addEventListener('click', () => {
    latexZoom = Math.min(latexZoom * 1.25, 5);
    applyLatexTransform();
  });

  btnLatexZoomOut.addEventListener('click', () => {
    latexZoom = Math.max(latexZoom / 1.25, 0.1);
    applyLatexTransform();
  });

  btnLatexZoomReset.addEventListener('click', () => {
    latexZoom = 1;
    latexPanX = 0;
    latexPanY = 0;
    applyLatexTransform();
  });

  latexPreviewViewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      latexZoom = Math.min(Math.max(latexZoom * delta, 0.1), 5);
      applyLatexTransform();
    },
    { passive: false }
  );

  latexPreviewViewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isLatexPanning = true;
    latexPanStartX = e.clientX - latexPanX;
    latexPanStartY = e.clientY - latexPanY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isLatexPanning) return;
    latexPanX = e.clientX - latexPanStartX;
    latexPanY = e.clientY - latexPanStartY;
    applyLatexTransform();
  });

  window.addEventListener('mouseup', () => {
    isLatexPanning = false;
  });

  // ── LaTeX sample chips ──

  document.querySelectorAll('.chip[data-latex-sample]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.latexSample;
      if (latexSamples[key]) {
        document
          .querySelectorAll('.chip[data-latex-sample]')
          .forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        latexEditor.setValue(latexSamples[key]);
        latexZoom = 1;
        latexPanX = 0;
        latexPanY = 0;
        applyLatexTransform();
      }
    });
  });

  // ── LaTeX PNG download ──

  function getLatexFilename(ext) {
    const name = latexFilenameInput.value.trim();
    if (name) return `${name}.${ext}`;
    return `latex-equation.${ext}`;
  }

  btnLatexDownloadPNG.addEventListener('click', () => {
    const content = latexPreviewEl.innerHTML;
    if (!content || latexPreviewEl.querySelector('p')) return;

    const scale = 3;
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:absolute;left:-9999px;top:-9999px;background:#fff;padding:40px;';
    wrapper.innerHTML = content;
    document.body.appendChild(wrapper);

    const katexCss = document.querySelector('link[href*="katex"]');
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:2000px;height:2000px;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (katexCss) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = katexCss.href;
      doc.head.appendChild(link);
    }

    const style = doc.createElement('style');
    style.textContent =
      'body{background:#fff;display:inline-block;padding:40px;margin:0;font-size:24px;}';
    doc.head.appendChild(style);
    doc.body.innerHTML = content;

    setTimeout(() => {
      const rect = doc.body.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${doc.documentElement.outerHTML}</div>
          </foreignObject>
        </svg>`;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, getLatexFilename('png'));
          document.body.removeChild(wrapper);
          document.body.removeChild(iframe);
        }, 'image/png');
      };
      img.onerror = () => {
        showLatexError('Failed to export PNG.');
        document.body.removeChild(wrapper);
        document.body.removeChild(iframe);
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    }, 500);
  });

  // ════════════════════════════════════════════
  //  Markdown Editor
  // ════════════════════════════════════════════

  const mdEditorSamples = {
    headings: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

Regular paragraph text below the headings.`,

    table: `| Feature       | Status | Notes            |
|---------------|--------|------------------|
| Markdown      | Done   | Full GFM support |
| Mermaid       | Done   | Embedded diagrams|
| LaTeX         | Done   | Via KaTeX        |
| Export HTML    | Done   | One-click export |`,

    code: `Here is some inline \`code\` in a sentence.

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\``,

    mermaid: `# Project Architecture

Below is a diagram of the system:

\`\`\`mermaid
graph TD
    Client[Browser] -->|HTTP| API[API Server]
    API -->|Query| DB[(Database)]
    API -->|Publish| MQ[Message Queue]
    MQ -->|Subscribe| Worker[Background Worker]
    Worker -->|Write| DB
\`\`\`

The worker processes jobs asynchronously.`,

    tasklist: `## Sprint Backlog

- [x] Set up project repository
- [x] Design database schema
- [x] Implement authentication
- [ ] Build dashboard UI
- [ ] Write integration tests
- [ ] Deploy to staging

## Bugs

- [x] Fix login redirect loop
- [ ] Resolve image upload timeout`,

    blockquote: `> **Note:** This is a simple blockquote.

> "The only way to do great work is to love what you do."
>
> — Steve Jobs

---

> **Warning**
>
> Nested content inside blockquotes works too:
>
> - Item one
> - Item two
> - Item three`,

    image: `# Images in Markdown

Images use the following syntax:

![Alt text](https://via.placeholder.com/600x200/1a1a2e/58a6ff?text=Markdown+Editor)

You can also use reference-style links:

![Placeholder][img1]

[img1]: https://via.placeholder.com/400x150/0d1117/3fb950?text=MarkAllDown`,
  };

  mdEditor = CodeMirror.fromTextArea(document.getElementById('md-code-editor'), {
    mode: 'markdown',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentWithTabs: false,
  });

  async function renderMdEditorPreview() {
    const code = mdEditor.getValue();
    if (!code.trim()) {
      mdEditorPreviewEl.innerHTML =
        '<p style="color:var(--text-muted)">Type Markdown on the left to see a live preview</p>';
      return;
    }

    mermaidRenderCounter = 0;
    await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const html = marked.parse(maybeStripFrontMatter(code));
    mdEditorPreviewEl.innerHTML = html;
    await renderMermaidBlocks(mdEditorPreviewEl);

    const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
    if (tab) tab.renderedHtml = mdEditorPreviewEl.innerHTML;
  }

  const debouncedMdEditorRender = debounce(renderMdEditorPreview, 300);
  mdEditor.on('change', debouncedMdEditorRender);

  document.querySelectorAll('.chip[data-md-sample]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.mdSample;
      if (mdEditorSamples[key]) {
        document
          .querySelectorAll('.chip[data-md-sample]')
          .forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        mdEditorNewTab(null, mdEditorSamples[key]);
      }
    });
  });

  btnMdEditorDownloadHTML.addEventListener('click', async () => {
    const content = mdEditorPreviewEl.innerHTML;
    if (
      !content ||
      mdEditorPreviewEl.querySelector('p[style]')?.textContent.includes('Type Markdown')
    )
      return;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>markdown-document</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 0 auto; padding: 40px 24px; line-height: 1.7; color: #1f2937; }
  h1, h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  pre { background: #f3f4f6; padding: 16px; border-radius: 6px; overflow-x: auto; }
  code { font-family: "JetBrains Mono", "Fira Code", monospace; font-size: 0.875em; background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 4px; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 4px solid #3b82f6; padding: 0.5em 1em; margin: 0 0 1em; background: #eff6ff; color: #4b5563; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
  th, td { padding: 8px 14px; border: 1px solid #e5e7eb; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  a { color: #3b82f6; }
  img { max-width: 100%; height: auto; }
  hr { border: none; height: 1px; background: #e5e7eb; margin: 1.5em 0; }
</style>
</head>
<body>
${content}
</body>
</html>`;

    if (window.electronAPI?.saveHtml) {
      const activeHtmlTab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
      const savedPath = await window.electronAPI.saveHtml({
        content: fullHtml,
        defaultPath: getDefaultSaveName(activeHtmlTab, 'html'),
      });
      if (savedPath) showToast('Saved: ' + savedPath.split(/[/\\]/).pop(), 'success');
    } else {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, 'markdown-document.html');
    }
  });

  // ════════════════════════════════════════════
  //  Markdown Reader
  // ════════════════════════════════════════════

  // ── Marked configuration with mermaid block support ──

  marked.use({
    gfm: true,
    breaks: false,
    renderer: {
      code({ text, lang }) {
        if (lang === 'mermaid') {
          mermaidRenderCounter++;
          const containerId = `md-mermaid-${mermaidRenderCounter}`;
          return `<div class="mermaid-block" data-mermaid-id="${containerId}" data-mermaid-src="${encodeURIComponent(text)}"></div>`;
        }
        const escaped = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const langClass = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${langClass}>${escaped}</code></pre>`;
      },
    },
  });

  async function renderMermaidBlocks(container) {
    container = container || markdownBody;
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
    if (!_stripFrontMatter) return content;
    // YAML front matter (--- ... ---)
    let m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (m) return content.slice(m[0].length);
    // TOML front matter (+++ ... +++)
    m = content.match(/^\+\+\+\r?\n[\s\S]*?\r?\n\+\+\+\r?\n?/);
    if (m) return content.slice(m[0].length);
    return content;
  }

  async function renderMarkdown(content, targetEl) {
    targetEl = targetEl || markdownBody;
    mermaidRenderCounter = 0;

    await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const html = marked.parse(maybeStripFrontMatter(content));
    targetEl.innerHTML = html;

    await renderMermaidBlocks(targetEl);
  }

  // ════════════════════════════════════════════
  //  Pages Mode
  // ════════════════════════════════════════════

  let pagesHistory = [];
  let pagesHistoryIdx = -1;
  let pagesCurrentPath = null;
  let pagesPendingNav = null;
  let _pagesFileList = [];
  let _pagesRootName = '';
  let _pagesInitialized = false;

  function formatFileDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (_) {
      return dateStr;
    }
  }

  function buildSidebar(files) {
    pagesFileTree.innerHTML = '';

    const rootFiles = files.filter((f) => !f.folder);
    const folders = {};
    files.forEach((f) => {
      if (f.folder) {
        if (!folders[f.folder]) folders[f.folder] = [];
        folders[f.folder].push(f);
      }
    });

    function makeFileItem(file) {
      const item = document.createElement('div');
      item.className = 'pages-file-item';
      item.dataset.path = file.path;
      item.dataset.title = file.title;

      const name = document.createElement('span');
      name.className = 'pages-file-item-name';
      name.textContent = file.title;
      item.appendChild(name);

      if (file.date) {
        const dateEl = document.createElement('span');
        dateEl.className = 'pages-file-item-date';
        // Short: "Jan 15" without year
        try {
          dateEl.textContent = new Date(file.date + 'T00:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
        } catch (_) {
          dateEl.textContent = file.date.slice(5); // MM-DD
        }
        item.appendChild(dateEl);
      }

      item.addEventListener('click', () => pagesNavigate(file.path));
      return item;
    }

    rootFiles.forEach((f) => pagesFileTree.appendChild(makeFileItem(f)));

    Object.entries(folders).forEach(([folderName, folderFiles]) => {
      const header = document.createElement('div');
      header.className = 'pages-folder-header';
      header.innerHTML = `<span>${folderName}</span><span class="pages-folder-count">${folderFiles.length}</span>`;

      const filesDiv = document.createElement('div');
      filesDiv.className = 'pages-folder-files';
      folderFiles.forEach((f) => filesDiv.appendChild(makeFileItem(f)));

      header.addEventListener('click', () => filesDiv.classList.toggle('collapsed'));

      pagesFileTree.appendChild(header);
      pagesFileTree.appendChild(filesDiv);
    });
  }

  function showPagesIndex() {
    pagesContentWrap.classList.add('hidden');
    pagesIndexView.classList.remove('hidden');
    pagesCurrentPath = null;
    pagesBreadcrumb.textContent = '';
    btnPagesBack.disabled = pagesHistoryIdx <= 0;
    btnPagesForward.disabled = pagesHistoryIdx >= pagesHistory.length - 1;

    pagesFileTree.querySelectorAll('.pages-file-item').forEach((el) => {
      el.classList.remove('active');
    });

    pagesIndexGrid.innerHTML = '';
    _pagesFileList.forEach((file) => {
      const card = document.createElement('div');
      card.className = 'pages-card';

      const meta = document.createElement('div');
      meta.className = 'pages-card-meta';
      if (file.folder) {
        const folderEl = document.createElement('span');
        folderEl.className = 'pages-card-folder';
        folderEl.textContent = file.folder;
        meta.appendChild(folderEl);
      }
      if (file.date) {
        const dateEl = document.createElement('span');
        dateEl.className = 'pages-card-date';
        dateEl.textContent = formatFileDate(file.date);
        meta.appendChild(dateEl);
      }
      if (meta.children.length) card.appendChild(meta);

      const title = document.createElement('div');
      title.className = 'pages-card-title';
      title.textContent = file.title;
      card.appendChild(title);

      if (file.excerpt) {
        const excerpt = document.createElement('div');
        excerpt.className = 'pages-card-excerpt';
        excerpt.textContent = file.excerpt;
        card.appendChild(excerpt);
      }

      card.addEventListener('click', () => pagesNavigate(file.path));
      pagesIndexGrid.appendChild(card);
    });
  }

  function processLiquidRenderer(template, { page, site, content }) {
    return template
      .replace(/\{\{\s*content\s*\}\}/g, content || '')
      .replace(/\{\{\s*(page|site)\.([\w]+)\s*\}\}/g, (m, ns, key) => {
        const val = (ns === 'page' ? page : site)[key];
        return val != null ? String(val) : '';
      })
      .replace(/\{%-?\s*include\s+[\w./\-]+[^%]*-?%\}/g, '');
  }

  async function pagesNavigate(pagePath, addToHistory = true, password) {
    // If navigating to 'index' and no index.md exists, show generated index
    if (pagePath === 'index' && !_pagesFileList.some((f) => f.path === 'index')) {
      if (addToHistory) {
        pagesHistory = pagesHistory.slice(0, pagesHistoryIdx + 1);
        pagesHistory.push('index');
        pagesHistoryIdx = pagesHistory.length - 1;
      }
      showPagesIndex();
      return;
    }

    pagesLoading.classList.remove('hidden');
    pagesEmptyState.classList.add('hidden');
    pagesContentWrap.classList.add('hidden');
    pagesIndexView.classList.add('hidden');

    const result = await window.electronAPI.loadPage({ pagePath, password });
    pagesLoading.classList.add('hidden');

    if (!result.success) {
      if (result.error === 'no-config') {
        pagesEmptyState.classList.remove('hidden');
        return;
      }
      if (result.needsPassword) {
        pagesPendingNav = { pagePath, addToHistory };
        syncPasswordInput.value = '';
        passwordModal.classList.remove('hidden');
        return;
      }
      showToast(result.error || 'Failed to load page', 'error');
      pagesEmptyState.classList.remove('hidden');
      return;
    }

    const renderedHtml = marked.parse(result.markdownContent);
    pagesBody.innerHTML = result.layoutHtml
      ? processLiquidRenderer(result.layoutHtml, {
          page: result.frontMatter,
          site: result.siteData,
          content: renderedHtml,
        })
      : renderedHtml;

    await renderMermaidBlocks(pagesBody);
    pagesInterceptLinks();
    pagesContentWrap.classList.remove('hidden');

    pagesCurrentPath = result.resolvedPath;
    if (addToHistory) {
      pagesHistory = pagesHistory.slice(0, pagesHistoryIdx + 1);
      pagesHistory.push(result.resolvedPath);
      pagesHistoryIdx = pagesHistory.length - 1;
    }
    pagesBreadcrumb.textContent = result.resolvedPath;
    btnPagesBack.disabled = pagesHistoryIdx <= 0;
    btnPagesForward.disabled = pagesHistoryIdx >= pagesHistory.length - 1;

    // Highlight active item in sidebar
    pagesFileTree.querySelectorAll('.pages-file-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.path === pagesCurrentPath);
    });
  }

  function pagesInterceptLinks() {
    pagesBody.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        href.startsWith('mailto:')
      )
        return;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        pagesNavigate(href);
      });
    });
  }

  async function pagesInit(password) {
    _pagesInitialized = false;
    pagesHistory = [];
    pagesHistoryIdx = -1;
    pagesCurrentPath = null;
    pagesBreadcrumb.textContent = '';
    btnPagesBack.disabled = true;
    btnPagesForward.disabled = true;
    pagesEmptyState.classList.add('hidden');
    pagesContentWrap.classList.add('hidden');
    pagesIndexView.classList.add('hidden');
    pagesFileTree.innerHTML = '';
    pagesLoading.classList.remove('hidden');

    const result = await window.electronAPI.listFiles(password ? { password } : undefined);
    pagesLoading.classList.add('hidden');

    if (!result.success) {
      if (result.error === 'no-config') {
        pagesEmptyState.classList.remove('hidden');
        return;
      }
      if (result.needsPassword) {
        pagesPendingNav = { reinit: true };
        syncPasswordInput.value = '';
        passwordModal.classList.remove('hidden');
        return;
      }
      showToast(result.error || 'Failed to load files', 'error');
      pagesEmptyState.classList.remove('hidden');
      return;
    }

    _pagesFileList = result.files;
    _pagesRootName = result.rootName;
    _pagesInitialized = true;
    pagesSidebarTitle.textContent = result.rootName;
    pagesIndexHeading.textContent = result.rootName;

    buildSidebar(result.files);
    await pagesNavigate('index', true);
  }

  btnPagesBack.addEventListener('click', () => {
    if (pagesHistoryIdx > 0) {
      pagesHistoryIdx--;
      pagesNavigate(pagesHistory[pagesHistoryIdx], false);
    }
  });
  btnPagesForward.addEventListener('click', () => {
    if (pagesHistoryIdx < pagesHistory.length - 1) {
      pagesHistoryIdx++;
      pagesNavigate(pagesHistory[pagesHistoryIdx], false);
    }
  });
  btnPagesRefresh.addEventListener('click', () => {
    if (pagesCurrentPath) pagesNavigate(pagesCurrentPath, false);
    else pagesInit();
  });

  btnPagesSidebarToggle.addEventListener('click', () => {
    pagesSidebar.classList.toggle('collapsed');
  });

  pagesSidebarSearch.addEventListener('input', () => {
    const q = pagesSidebarSearch.value.toLowerCase().trim();
    pagesFileTree.querySelectorAll('.pages-file-item').forEach((el) => {
      const name = (el.dataset.title || '').toLowerCase();
      el.style.display = !q || name.includes(q) ? '' : 'none';
    });
    pagesFileTree.querySelectorAll('.pages-folder-header').forEach((hdr) => {
      const filesDiv = hdr.nextElementSibling;
      if (!filesDiv) return;
      const anyVisible = [...filesDiv.querySelectorAll('.pages-file-item')].some(
        (el) => el.style.display !== 'none'
      );
      hdr.style.display = !q || anyVisible ? '' : 'none';
      if (q) filesDiv.classList.remove('collapsed');
    });
  });

  // Pages settings source toggle
  [pagesSourceLocal, pagesSourceSsh].forEach((r) => {
    r.addEventListener('change', () => {
      const ssh = pagesSourceSsh.checked;
      pagesLocalPathRow.classList.toggle('hidden', ssh);
      pagesRemotePathRow.classList.toggle('hidden', !ssh);
      pagesSshHint.style.display = ssh ? '' : 'none';
    });
  });

  // ── Shared tab bar rendering ──

  const emptyStateHtml = markdownBody.innerHTML;

  function renderTabBar(barEl, tabs, activeId, onSwitch, onClose) {
    barEl.innerHTML = '';
    tabs.forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = 'file-tab' + (tab.id === activeId ? ' active' : '');
      btn.title = tab.filePath || tab.fileName;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-tab-name';
      nameSpan.textContent = tab.fileName;

      nameSpan.addEventListener('click', (e) => {
        if (tab.id !== activeId) return;
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'file-tab-name-input';
        input.value = tab.fileName;

        function commitRename() {
          const newName = input.value.trim();
          if (newName && newName !== tab.fileName) {
            tab.fileName = newName;
          }
          renderTabBar(barEl, tabs, activeId, onSwitch, onClose);
        }

        input.addEventListener('blur', commitRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            input.blur();
          } else if (ke.key === 'Escape') {
            input.removeEventListener('blur', commitRename);
            renderTabBar(barEl, tabs, activeId, onSwitch, onClose);
          }
        });
        input.addEventListener('click', (ce) => ce.stopPropagation());

        nameSpan.replaceWith(input);
        input.focus();
        input.select();
      });

      btn.appendChild(nameSpan);

      const closeSpan = document.createElement('span');
      closeSpan.className = 'file-tab-close';
      closeSpan.textContent = '\u00d7';
      closeSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        onClose(tab.id);
      });
      btn.appendChild(closeSpan);

      btn.addEventListener('click', () => onSwitch(tab.id));
      barEl.appendChild(btn);
    });
  }

  // ── Reader tabs ──

  function readerShowEmpty() {
    markdownBody.innerHTML = emptyStateHtml;
    activeReaderTabId = null;
    renderTabBar(
      readerTabBar,
      readerTabs,
      null,
      () => {},
      () => {}
    );
  }

  function readerSaveScroll() {
    const tab = readerTabs.find((t) => t.id === activeReaderTabId);
    if (tab) tab.scrollTop = readerScrollContainer.scrollTop;
  }

  async function readerActivateTab(tabId) {
    readerSaveScroll();
    const tab = readerTabs.find((t) => t.id === tabId);
    if (!tab) return;
    activeReaderTabId = tabId;

    if (tab.renderedHtml) {
      markdownBody.innerHTML = tab.renderedHtml;
    } else {
      await renderMarkdown(tab.rawContent);
      tab.renderedHtml = markdownBody.innerHTML;
    }

    readerScrollContainer.scrollTop = tab.scrollTop || 0;
    renderTabBar(readerTabBar, readerTabs, activeReaderTabId, readerActivateTab, readerCloseTab);
  }

  function readerCloseTab(tabId) {
    const idx = readerTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    readerTabs.splice(idx, 1);

    if (readerTabs.length === 0) {
      readerShowEmpty();
      return;
    }

    if (activeReaderTabId === tabId) {
      const newIdx = Math.min(idx, readerTabs.length - 1);
      readerActivateTab(readerTabs[newIdx].id);
    } else {
      renderTabBar(readerTabBar, readerTabs, activeReaderTabId, readerActivateTab, readerCloseTab);
    }
  }

  async function readerOpenFile(filePath, content) {
    const existing = readerTabs.find((t) => t.filePath === filePath);
    if (existing) {
      await readerActivateTab(existing.id);
      return;
    }

    const id = ++tabIdCounter;
    const fileName = filePath.split(/[/\\]/).pop();
    const tab = { id, filePath, fileName, rawContent: content, renderedHtml: null, scrollTop: 0 };
    readerTabs.push(tab);
    await readerActivateTab(id);
  }

  // ── Markdown Editor tabs ──

  function mdEditorShowEmpty() {
    mdEditor.setValue('');
    mdEditorPreviewEl.innerHTML =
      '<p style="color:var(--text-muted)">Type Markdown on the left to see a live preview</p>';
    activeMdEditorTabId = null;
    renderTabBar(
      mdEditorTabBar,
      mdEditorTabs,
      null,
      () => {},
      () => {}
    );
  }

  function mdEditorSaveCurrentTab() {
    const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
    if (tab) {
      tab.content = mdEditor.getValue();
      tab.scrollTop = mdEditor.getScrollInfo().top;
      tab.renderedHtml = mdEditorPreviewEl.innerHTML;
    }
  }

  async function mdEditorActivateTab(tabId) {
    mdEditorSaveCurrentTab();
    const tab = mdEditorTabs.find((t) => t.id === tabId);
    if (!tab) return;
    activeMdEditorTabId = tabId;

    mdEditor.setValue(tab.content);
    mdEditor.scrollTo(0, tab.scrollTop || 0);

    if (tab.renderedHtml) {
      mdEditorPreviewEl.innerHTML = tab.renderedHtml;
    } else {
      await renderMdEditorPreview();
    }

    renderTabBar(
      mdEditorTabBar,
      mdEditorTabs,
      activeMdEditorTabId,
      mdEditorActivateTab,
      mdEditorCloseTab
    );
  }

  function mdEditorCloseTab(tabId) {
    const idx = mdEditorTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    mdEditorTabs.splice(idx, 1);

    if (mdEditorTabs.length === 0) {
      mdEditorShowEmpty();
      return;
    }

    if (activeMdEditorTabId === tabId) {
      const newIdx = Math.min(idx, mdEditorTabs.length - 1);
      mdEditorActivateTab(mdEditorTabs[newIdx].id);
    } else {
      renderTabBar(
        mdEditorTabBar,
        mdEditorTabs,
        activeMdEditorTabId,
        mdEditorActivateTab,
        mdEditorCloseTab
      );
    }
  }

  function mdEditorNewTab(filePath, content) {
    if (filePath) {
      const existing = mdEditorTabs.find((t) => t.filePath === filePath);
      if (existing) {
        mdEditorActivateTab(existing.id);
        return;
      }
    }

    mdEditorSaveCurrentTab();
    const id = ++tabIdCounter;
    const fileName = filePath ? filePath.split(/[/\\]/).pop() : 'untitled.md';
    const tab = {
      id,
      filePath: filePath || null,
      fileName,
      content: content || '',
      scrollTop: 0,
      renderedHtml: null,
    };
    mdEditorTabs.push(tab);
    mdEditorActivateTab(id);
  }

  btnMdEditorNewTab.addEventListener('click', () => mdEditorNewTab(null, ''));

  btnMdEditorOpenFile.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const results = await window.electronAPI.openFile();
    if (!results) return;
    for (const result of results) {
      mdEditorNewTab(result.filePath, result.content);
    }
  });

  // ── File open (dialog) ──

  async function openMarkdownFile() {
    if (!window.electronAPI) return;

    const results = await window.electronAPI.openFile();
    if (!results) return;

    if (currentMode !== 'md-editor') {
      switchMode('md-editor');
    }

    for (const result of results) {
      mdEditorNewTab(result.filePath, result.content);
    }
  }

  async function openMarkdownFileInReader() {
    if (!window.electronAPI) return;

    const results = await window.electronAPI.openFile();
    if (!results) return;

    for (const result of results) {
      await readerOpenFile(result.filePath, result.content);
    }
  }

  btnOpenFile.addEventListener('click', openMarkdownFileInReader);

  if (window.electronAPI && window.electronAPI.onMenuOpenFile) {
    window.electronAPI.onMenuOpenFile(() => {
      if (currentMode === 'reader') {
        openMarkdownFileInReader();
      } else {
        openMarkdownFile();
      }
    });
  }

  // ── Open from SSH ──

  let openFromSshFiles = [];
  let pendingOpenFromSsh = null;

  function closeOpenFromSshModal() {
    openFromSshModal.classList.add('hidden');
    openFromSshList.innerHTML = '';
    openFromSshPath.value = '';
    openFromSshError.classList.add('hidden');
    openFromSshError.textContent = '';
    openFromSshLoading.classList.add('hidden');
    openFromSshListWrap.classList.add('hidden');
    openFromSshFiles = [];
    pendingOpenFromSsh = null;
  }

  async function loadOpenFromSshList(password) {
    openFromSshError.classList.add('hidden');
    openFromSshLoading.classList.remove('hidden');
    openFromSshListWrap.classList.add('hidden');
    const result = await window.electronAPI.sshListFiles(password ? { password } : {});
    openFromSshLoading.classList.add('hidden');

    if (result.success) {
      openFromSshFiles = result.files || [];
      openFromSshList.innerHTML = '';
      if (openFromSshFiles.length === 0) {
        openFromSshError.textContent = 'No .md, .markdown, or .txt files in the remote folder.';
        openFromSshError.classList.remove('hidden');
      } else {
        openFromSshFiles.forEach((f) => {
          const li = document.createElement('li');
          li.className = 'open-from-ssh-item';
          const label = document.createElement('label');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'open-from-ssh-checkbox';
          cb.dataset.path = f.path;
          label.appendChild(cb);
          label.appendChild(document.createTextNode(' ' + f.name));
          li.appendChild(label);
          openFromSshList.appendChild(li);
        });
        openFromSshListWrap.classList.remove('hidden');
      }
      return true;
    }

    openFromSshError.textContent = result.error || 'Failed to load remote files.';
    openFromSshError.classList.remove('hidden');
    if (result.needsPassword) {
      pendingOpenFromSsh = { action: 'list' };
      syncPasswordInput.value = '';
      passwordModal.classList.remove('hidden');
    }
    return false;
  }

  async function openOpenFromSshModal() {
    if (!window.electronAPI || !window.electronAPI.sshListFiles) return;
    openFromSshModal.classList.remove('hidden');
    await loadOpenFromSshList();
  }

  btnOpenFromSsh.addEventListener('click', openOpenFromSshModal);
  if (btnOpenFromSshMermaid) btnOpenFromSshMermaid.addEventListener('click', openOpenFromSshModal);
  if (btnOpenFromSshLatex) btnOpenFromSshLatex.addEventListener('click', openOpenFromSshModal);
  if (btnOpenFromSshMdEditor)
    btnOpenFromSshMdEditor.addEventListener('click', openOpenFromSshModal);
  btnOpenFromSshClose.addEventListener('click', closeOpenFromSshModal);
  btnOpenFromSshCancel.addEventListener('click', closeOpenFromSshModal);

  openFromSshModal.addEventListener('click', (e) => {
    if (e.target === openFromSshModal) closeOpenFromSshModal();
  });

  btnOpenFromSshOpen.addEventListener('click', async () => {
    if (!window.electronAPI || !window.electronAPI.sshReadFile) return;

    const pathInput = openFromSshPath.value.trim();
    const selected = Array.from(
      openFromSshList.querySelectorAll('.open-from-ssh-checkbox:checked')
    ).map((cb) => cb.dataset.path);
    const toOpen = pathInput ? [pathInput] : selected;

    if (toOpen.length === 0) {
      showToast('Select file(s) from the list or enter a path', 'error');
      return;
    }

    const openResults = [];
    let needsPassword = false;
    for (const remotePath of toOpen) {
      const result = await window.electronAPI.sshReadFile({ remotePath });
      if (result.success) {
        openResults.push({
          filePath: result.filePath,
          content: result.content,
          fileName: result.fileName,
        });
      } else if (result.needsPassword) {
        needsPassword = true;
        pendingOpenFromSsh = { action: 'read', paths: toOpen };
        syncPasswordInput.value = '';
        passwordModal.classList.remove('hidden');
        return;
      } else {
        showToast(result.error || 'Failed to open ' + remotePath, 'error');
      }
    }

    if (openResults.length > 0) {
      if (currentMode === 'reader') {
        for (const r of openResults) {
          await readerOpenFile(r.filePath, r.content);
        }
      } else {
        if (currentMode !== 'md-editor') switchMode('md-editor');
        for (const r of openResults) {
          mdEditorNewTab(r.filePath, r.content);
        }
      }
      closeOpenFromSshModal();
      showToast('Opened ' + openResults.length + ' file(s)', 'success');
    }
  });

  if (window.electronAPI && window.electronAPI.onMenuOpenFromSsh) {
    window.electronAPI.onMenuOpenFromSsh(() => openOpenFromSshModal());
  }

  if (window.electronAPI && window.electronAPI.onFileOpened) {
    window.electronAPI.onFileOpened(async (data) => {
      if (currentMode !== 'md-editor') {
        switchMode('md-editor');
      }
      mdEditorNewTab(data.filePath, data.content);
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      if (currentMode === 'reader') {
        openMarkdownFileInReader();
      } else {
        openMarkdownFile();
      }
    }
  });

  // ── Save as MD ──

  function getDefaultSaveName(tab, ext) {
    if (tab) {
      const name = tab.fileName || (tab.filePath && tab.filePath.split(/[/\\]/).pop());
      if (name && !/^untitled/i.test(name)) {
        return name.replace(/\.[^.]+$/, '') + '.' + ext;
      }
    }
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${date}-untitled.${ext}`;
  }

  async function saveCurrentAsMd() {
    if (!window.electronAPI) return;

    let content = null;
    let defaultPath;

    if (currentMode === 'reader') {
      const tab = readerTabs.find((t) => t.id === activeReaderTabId);
      if (!tab) return;
      content = tab.rawContent;
      if (tab.filePath && !tab.filePath.startsWith('ssh://')) {
        defaultPath = tab.filePath;
      } else {
        defaultPath = getDefaultSaveName(tab, 'md');
      }
    } else if (currentMode === 'md-editor') {
      content = mdEditor.getValue();
      const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
      if (tab) {
        if (tab.filePath && !tab.filePath.startsWith('ssh://')) {
          defaultPath = tab.filePath;
        } else {
          defaultPath = getDefaultSaveName(tab, 'md');
        }
      } else {
        defaultPath = getDefaultSaveName(null, 'md');
      }
    }

    if (content == null) return;
    const savedPath = await window.electronAPI.saveFile({ defaultPath, content });
    if (savedPath) {
      if (currentMode === 'reader') {
        const tab = readerTabs.find((t) => t.id === activeReaderTabId);
        if (tab) {
          tab.filePath = savedPath;
          tab.fileName = savedPath.split(/[/\\]/).pop();
          renderTabBar(
            readerTabBar,
            readerTabs,
            activeReaderTabId,
            readerActivateTab,
            readerCloseTab
          );
        }
      } else if (currentMode === 'md-editor') {
        const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
        if (tab) {
          tab.filePath = savedPath;
          tab.fileName = savedPath.split(/[/\\]/).pop();
          renderTabBar(
            mdEditorTabBar,
            mdEditorTabs,
            activeMdEditorTabId,
            mdEditorActivateTab,
            mdEditorCloseTab
          );
        }
      }
    }
  }

  btnSaveMdEditor.addEventListener('click', saveCurrentAsMd);

  if (window.electronAPI && window.electronAPI.onMenuSaveFile) {
    window.electronAPI.onMenuSaveFile(() => saveCurrentAsMd());
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentAsMd();
    }
  });

  // ── Initialize default Markdown Editor tab ──

  mdEditorNewTab(null, mdEditor.getValue());

  // ════════════════════════════════════════════
  //  Settings Modal
  // ════════════════════════════════════════════

  // ── Settings tab switching ──

  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  const settingsTabPanels = document.querySelectorAll('.settings-tab-panel');

  function switchSettingsTab(tab) {
    settingsTabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.settingsTab === tab);
    });
    settingsTabPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== `settings-tab-${tab}`);
    });
  }

  settingsTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
  });

  function openSettingsModal() {
    settingsModal.classList.remove('hidden');
    switchSettingsTab('ssh');
    sshTestResult.textContent = '';
    sshTestResult.className = 'settings-test-result';
    if (window.electronAPI && window.electronAPI.loadSettings) {
      window.electronAPI.loadSettings().then((s) => {
        if (!s) return;
        settingSshHost.value = s.sshHost || '';
        settingSshUser.value = s.sshUser || '';
        settingSshPort.value = s.sshPort || 22;
        settingRemotePath.value = s.remotePath || '';
        updateKeyStatus(s.hasKey);
        // Pages settings
        const pg = s.pages || {};
        const isSsh = pg.source === 'ssh';
        pagesSourceSsh.checked = isSsh;
        pagesSourceLocal.checked = !isSsh;
        pagesLocalPathRow.classList.toggle('hidden', isSsh);
        pagesRemotePathRow.classList.toggle('hidden', !isSsh);
        pagesSshHint.style.display = isSsh ? '' : 'none';
        settingPagesLocalPath.value = pg.localPath || '';
        settingPagesRemotePath.value = pg.remotePath || '';
        // General settings
        const gen = s.general || {};
        _stripFrontMatter = gen.stripFrontMatter ?? true;
        generalStripFrontMatterEl.checked = _stripFrontMatter;
      });
    }
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
    settingSshPassword.value = '';
  }

  function updateKeyStatus(hasKey) {
    if (hasKey) {
      sshKeyStatus.textContent = 'SSH key configured';
      sshKeyStatus.className = 'settings-key-status key-ok';
    } else {
      sshKeyStatus.textContent = 'No SSH key — password required for sync';
      sshKeyStatus.className = 'settings-key-status key-missing';
    }
  }

  if (window.electronAPI && window.electronAPI.loadSettings) {
    window.electronAPI.loadSettings().then((s) => {
      if (!s) return;
      _stripFrontMatter = s.general?.stripFrontMatter ?? true;
    });
  }

  btnSettings.addEventListener('click', openSettingsModal);
  btnSettingsClose.addEventListener('click', closeSettingsModal);
  btnSettingsCancel.addEventListener('click', closeSettingsModal);

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  btnSettingsSave.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const settings = {
      sshHost: settingSshHost.value.trim(),
      sshUser: settingSshUser.value.trim(),
      sshPort: parseInt(settingSshPort.value, 10) || 22,
      remotePath: settingRemotePath.value.trim(),
      pages: {
        source: pagesSourceSsh.checked ? 'ssh' : 'local',
        localPath: settingPagesLocalPath.value.trim(),
        remotePath: settingPagesRemotePath.value.trim(),
      },
      general: {
        stripFrontMatter: generalStripFrontMatterEl.checked,
      },
    };
    await window.electronAPI.saveSettings(settings);
    _stripFrontMatter = generalStripFrontMatterEl.checked;
    showToast('Settings saved', 'success');
    closeSettingsModal();
    _pagesInitialized = false;
    if (currentMode === 'pages') pagesInit();
  });

  // ── Test connection ──

  btnSshTest.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    sshTestResult.textContent = 'Testing...';
    sshTestResult.className = 'settings-test-result';
    const config = {
      sshHost: settingSshHost.value.trim(),
      sshUser: settingSshUser.value.trim(),
      sshPort: parseInt(settingSshPort.value, 10) || 22,
      password: settingSshPassword.value || undefined,
    };
    const result = await window.electronAPI.testSshConnection(config);
    if (result.success) {
      sshTestResult.textContent = 'Connection successful';
      sshTestResult.className = 'settings-test-result test-ok';
    } else {
      sshTestResult.textContent = result.error || 'Connection failed';
      sshTestResult.className = 'settings-test-result test-fail';
    }
  });

  // ── SSH key setup ──

  btnSshSetupKey.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const password = settingSshPassword.value;
    const host = settingSshHost.value.trim();
    const user = settingSshUser.value.trim();
    const port = parseInt(settingSshPort.value, 10) || 22;

    if (!host || !user) {
      showToast('Enter SSH host and username first', 'error');
      return;
    }
    if (!password) {
      showToast('Enter your SSH password to set up key', 'error');
      return;
    }

    btnSshSetupKey.disabled = true;
    btnSshSetupKey.textContent = 'Setting up...';

    const result = await window.electronAPI.copySshKey({
      password,
      sshHost: host,
      sshUser: user,
      sshPort: port,
    });

    btnSshSetupKey.disabled = false;
    btnSshSetupKey.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> Setup SSH Key';

    if (result.success) {
      showToast('SSH key set up successfully', 'success');
      updateKeyStatus(true);
      settingSshPassword.value = '';
    } else {
      showToast(result.error || 'Failed to set up SSH key', 'error');
    }
  });

  // ════════════════════════════════════════════
  //  Sync
  // ════════════════════════════════════════════

  let pendingSyncData = null;

  async function syncCurrentFile(password) {
    if (!window.electronAPI) return;

    let content = null;
    let fileName = 'untitled.md';

    if (currentMode === 'reader') {
      const tab = readerTabs.find((t) => t.id === activeReaderTabId);
      if (!tab) {
        showToast('No file to sync', 'error');
        return;
      }
      content = tab.rawContent;
      fileName = tab.fileName;
    } else if (currentMode === 'md-editor') {
      const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
      content = mdEditor.getValue();
      if (tab) fileName = tab.fileName;
    }

    if (content == null) return;

    showToast('Syncing...', 'info');

    const result = await window.electronAPI.syncFile({
      content,
      fileName,
      password: password || undefined,
    });

    if (result.success) {
      showToast('Synced: ' + fileName, 'success');
    } else if (result.needsPassword) {
      pendingSyncData = { content, fileName };
      syncPasswordInput.value = '';
      passwordModal.classList.remove('hidden');
    } else {
      showToast(result.error || 'Sync failed', 'error');
    }
  }

  btnSyncMdEditor.addEventListener('click', () => syncCurrentFile());

  // ── Password prompt for sync ──

  function closePasswordModal() {
    passwordModal.classList.add('hidden');
    syncPasswordInput.value = '';
    pendingSyncData = null;
  }

  btnPasswordClose.addEventListener('click', closePasswordModal);
  btnPasswordCancel.addEventListener('click', closePasswordModal);

  passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) closePasswordModal();
  });

  btnPasswordConfirm.addEventListener('click', async () => {
    const password = syncPasswordInput.value;
    if (!password) return;
    passwordModal.classList.add('hidden');

    if (pagesPendingNav) {
      const pending = pagesPendingNav;
      pagesPendingNav = null;
      syncPasswordInput.value = '';
      if (pending.reinit) {
        await pagesInit(password);
      } else {
        await pagesNavigate(pending.pagePath, pending.addToHistory, password);
      }
      return;
    }

    if (pendingOpenFromSsh) {
      const pending = pendingOpenFromSsh;
      pendingOpenFromSsh = null;
      if (pending.action === 'list') {
        const ok = await loadOpenFromSshList(password);
        if (!ok && pendingOpenFromSsh === null) {
          pendingOpenFromSsh = { action: 'list' };
          passwordModal.classList.remove('hidden');
        }
      } else if (pending.action === 'read' && pending.paths && pending.paths.length > 0) {
        if (currentMode !== 'md-editor') switchMode('md-editor');
        for (const remotePath of pending.paths) {
          const result = await window.electronAPI.sshReadFile({ remotePath, password });
          if (result.success) {
            mdEditorNewTab(result.filePath, result.content);
          } else {
            showToast(result.error || 'Failed to open ' + remotePath, 'error');
          }
        }
        closeOpenFromSshModal();
        showToast('Opened ' + pending.paths.length + ' file(s)', 'success');
      }
      syncPasswordInput.value = '';
      return;
    }

    if (pendingSyncData) {
      const { content, fileName } = pendingSyncData;
      pendingSyncData = null;
      showToast('Syncing...', 'info');
      const result = await window.electronAPI.syncFile({ content, fileName, password });
      if (result.success) {
        showToast('Synced: ' + fileName, 'success');
      } else {
        showToast(result.error || 'Sync failed', 'error');
      }
    }
    syncPasswordInput.value = '';
  });

  syncPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnPasswordConfirm.click();
    }
  });

  // ════════════════════════════════════════════
  //  Toast
  // ════════════════════════════════════════════

  let toastTimer = null;

  function showToast(message, type) {
    if (toastTimer) clearTimeout(toastTimer);
    statusToast.textContent = message;
    statusToast.className = 'status-toast toast-' + (type || 'info');
    toastTimer = setTimeout(() => {
      statusToast.classList.add('hidden');
    }, 3000);
  }

  // ════════════════════════════════════════════
  //  Find in Page (custom renderer implementation; no webContents.findInPage)
  // ════════════════════════════════════════════

  let findBarVisible = false;
  let customFindHighlightSpans = [];
  let customFindMatchSpans = [];
  let customFindCurrentIndex = 0;
  let customFindMatchCount = 0;

  function getSearchableRoot() {
    if (currentMode === 'reader') return markdownBody;
    if (currentMode === 'md-editor') return mdEditorPreviewEl;
    return null;
  }

  function clearCustomFindHighlights() {
    customFindHighlightSpans.forEach((span) => {
      if (span.parentNode) {
        const text = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(text, span);
      }
    });
    customFindHighlightSpans = [];
    customFindMatchSpans = [];
    customFindCurrentIndex = 0;
    customFindMatchCount = 0;
  }

  function runCustomFind(searchText, caseSensitive = false) {
    const root = getSearchableRoot();
    if (!root || !searchText) return 0;
    clearCustomFindHighlights();

    const segments = [];
    let globalIndex = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      segments.push({ node, start: globalIndex, end: globalIndex + text.length, text });
      globalIndex += text.length;
    }
    const fullText = segments.map((s) => s.text).join('');
    const searchLen = searchText.length;
    const matchIndices = [];
    if (caseSensitive) {
      let i = 0;
      while ((i = fullText.indexOf(searchText, i)) !== -1) {
        matchIndices.push(i);
        i += 1;
      }
    } else {
      const fullTextLower = fullText.toLowerCase();
      const searchLower = searchText.toLowerCase();
      let i = 0;
      while ((i = fullTextLower.indexOf(searchLower, i)) !== -1) {
        matchIndices.push(i);
        i += 1;
      }
    }

    const toProcessByMatch = matchIndices.map((matchStart) => {
      const matchEnd = matchStart + searchLen;
      const list = [];
      for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        const overlapStart = Math.max(matchStart, seg.start);
        const overlapEnd = Math.min(matchEnd, seg.end);
        if (overlapStart < overlapEnd) {
          list.push({
            segmentIndex: si,
            node: seg.node,
            localStart: overlapStart - seg.start,
            localEnd: overlapEnd - seg.start,
          });
        }
      }
      list.sort((a, b) => b.segmentIndex - a.segmentIndex || b.localStart - a.localStart);
      return list;
    });

    for (let m = toProcessByMatch.length - 1; m >= 0; m--) {
      const matchSpans = [];
      for (const { node: n, localStart, localEnd } of toProcessByMatch[m]) {
        if (!n.parentNode) continue;
        const rest = n.splitText(localStart);
        rest.splitText(localEnd - localStart);
        const span = document.createElement('span');
        span.className = 'find-highlight';
        span.textContent = rest.textContent;
        rest.parentNode.replaceChild(span, rest);
        customFindHighlightSpans.push(span);
        matchSpans.push(span);
      }
      customFindMatchSpans.unshift(matchSpans);
    }

    customFindMatchCount = customFindMatchSpans.length;
    customFindCurrentIndex = 0;
    if (customFindMatchSpans.length > 0 && customFindMatchSpans[0].length > 0) {
      customFindMatchSpans[0][0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return customFindMatchCount;
  }

  function updateFindMatchCountDisplay() {
    if (customFindMatchCount === 0) {
      findMatchCount.textContent = 'No results';
      findMatchCount.classList.add('no-results');
    } else {
      findMatchCount.textContent = `${customFindCurrentIndex + 1} of ${customFindMatchCount}`;
      findMatchCount.classList.remove('no-results');
    }
  }

  function customFindNext() {
    if (customFindMatchCount === 0) return;
    customFindCurrentIndex = (customFindCurrentIndex + 1) % customFindMatchCount;
    const spans = customFindMatchSpans[customFindCurrentIndex];
    if (spans && spans[0]) spans[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    updateFindMatchCountDisplay();
  }

  function customFindPrev() {
    if (customFindMatchCount === 0) return;
    customFindCurrentIndex =
      (customFindCurrentIndex - 1 + customFindMatchCount) % customFindMatchCount;
    const spans = customFindMatchSpans[customFindCurrentIndex];
    if (spans && spans[0]) spans[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    updateFindMatchCountDisplay();
  }

  function openFindBar() {
    findBarVisible = true;
    findBar.classList.remove('hidden');
    findInput.focus();
    findInput.select();
    clearCustomFindHighlights();
  }

  function closeFindBar() {
    findBarVisible = false;
    findBar.classList.add('hidden');
    findMatchCount.textContent = '';
    findMatchCount.classList.remove('no-results');
    findInput.value = '';
    clearCustomFindHighlights();
  }

  function triggerFind() {
    const text = findInput.value;
    clearCustomFindHighlights();
    if (!text) {
      findMatchCount.textContent = '';
      findMatchCount.classList.remove('no-results');
      return;
    }
    const root = getSearchableRoot();
    if (!root) {
      findMatchCount.textContent = '';
      findMatchCount.classList.remove('no-results');
      return;
    }
    const caseSensitive = findCaseSensitive && findCaseSensitive.checked;
    runCustomFind(text, caseSensitive);
    updateFindMatchCountDisplay();
  }

  findInput.addEventListener('input', triggerFind);
  if (findCaseSensitive) findCaseSensitive.addEventListener('change', triggerFind);

  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        customFindPrev();
      } else {
        customFindNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFindBar();
    }
  });

  btnFindNext.addEventListener('click', () => customFindNext());
  btnFindPrev.addEventListener('click', () => customFindPrev());
  btnFindClose.addEventListener('click', closeFindBar);

  if (window.electronAPI && window.electronAPI.onMenuFind) {
    window.electronAPI.onMenuFind(() => openFindBar());
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      openFindBar();
    }
    if (e.key === 'Escape' && findBarVisible) {
      closeFindBar();
    }
  });
})();
