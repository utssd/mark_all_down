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

  // Platform-aware modifier key: Cmd on macOS, Ctrl on Linux/Windows.
  const IS_MAC = window.electronAPI?.platform === 'darwin';
  const MOD_KEY_EVENT = IS_MAC ? 'metaKey' : 'ctrlKey';

  function localizeShortcutHints() {
    if (!IS_MAC) return;
    const tooltips = [
      ['btn-open-file-editor', 'Open file (⌘O)'],
      ['btn-save-editor',      'Save file (⌘S)'],
      ['btn-open-file',        'Open file (⌘O)'],
      ['btn-terminal-new-tab', 'New terminal (⌘⇧T)'],
    ];
    tooltips.forEach(([id, title]) => {
      const el = document.getElementById(id);
      if (el) el.title = title;
    });
    const kbd = document.getElementById('kbd-open-hint');
    if (kbd) kbd.textContent = '⌘O';
  }

  let _stripFrontMatter = true;
  const REMOTE_PROVIDER_WEBDAV = 'webdav';
  const REMOTE_PROVIDER_CLOUD = 'cloud';
  const REMOTE_BROWSER_MODE_OPEN = 'open';
  const REMOTE_BROWSER_MODE_FOLDER = 'folder';
  const REMOTE_BROWSER_MODE_SAVE = 'save';
  const REMOTE_REQUEST_TIMEOUT_MS = 15000;
  const PAGES_RENDER_TIMEOUT_MS = 10000;

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

  let _xtermReady = false;
  async function ensureXterm() {
    if (_xtermReady) return;
    await loadScript('./node_modules/@xterm/xterm/lib/xterm.js');
    await loadScript('./node_modules/@xterm/addon-fit/lib/addon-fit.js');
    await loadScript('./node_modules/@xterm/addon-web-links/lib/addon-web-links.js');
    await loadScript('./node_modules/@xterm/addon-search/lib/addon-search.js');
    _xtermReady = true;
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
  let currentEditorSubMode = 'md-editor';

  function isEditorSubMode(subMode) {
    return currentMode === 'editor' && currentEditorSubMode === subMode;
  }
  let mermaidRenderCounter = 0;

  let latexZoom = 1;
  let latexPanX = 0;
  let latexPanY = 0;
  let isLatexPanning = false;
  let latexPanStartX = 0;
  let latexPanStartY = 0;

  const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

  const RENDER_PROGRESSIVE_THRESHOLD = 1 * 1024 * 1024;  // 1 MB — progressive rendering
  const RENDER_VIRTUAL_THRESHOLD     = 5 * 1024 * 1024;   // 5 MB — virtual scrolling
  const LARGE_FILE_MAX_BYTES         = 200 * 1024 * 1024;  // 200 MB — refuse to open

  function classifyFileType(filePath, explicitType) {
    if (explicitType) return explicitType;
    const dot = (filePath || '').lastIndexOf('.');
    const ext = dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
    if (ext === '.pdf') return 'pdf';
    if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
    return 'plaintext';
  }

  let tabIdCounter = 0;
  let readerTabs = [];
  let activeReaderTabId = null;
  let mdEditorTabs = [];
  let activeMdEditorTabId = null;
  let _remoteProvider = REMOTE_PROVIDER_WEBDAV;
  let _remoteBrowserProvider = REMOTE_PROVIDER_WEBDAV;
  let _remoteBrowserMode = REMOTE_BROWSER_MODE_OPEN;
  let _remoteBrowserSelectedFiles = [];
  let _pendingSaveState = null;
  let _mermaidRemoteRef = null;
  let _latexRemoteRef = null;
  let _mermaidLocalPath = null;
  let _latexLocalPath = null;

  // ── DOM refs ──

  const previewEl = document.getElementById('preview');
  const previewViewport = document.getElementById('preview-viewport');
  const errorBar = document.getElementById('error-bar');
  const themeSelect = document.getElementById('diagram-theme');
  const btnDownloadSVG = document.getElementById('btn-download-svg');
  const btnDownloadPNG = document.getElementById('btn-download-png');
  const btnSaveFileEditor = document.getElementById('btn-save-editor');
  const btnSaveRemoteEditor = document.getElementById('btn-save-remote-editor');
  const filenameInput = document.getElementById('filename-input');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');

  const modeTabs = document.querySelectorAll('.mode-tab');
  const readerOnlyEls = document.querySelectorAll('.reader-mode-only');
  const editorOnlyEls = document.querySelectorAll('.editor-mode-only');
  const mermaidSubmodeEls = document.querySelectorAll('.mermaid-submode-only');
  const latexSubmodeEls = document.querySelectorAll('.latex-submode-only');
  const mdEditorSubmodeEls = document.querySelectorAll('.md-editor-submode-only');
  const editorSubmodeTabs = document.querySelectorAll('.editor-submode-tab');
  const btnOpenFile = document.getElementById('btn-open-file');
  const btnOpenFileEditor = document.getElementById('btn-open-file-editor');
  const btnOpenFromWebdavEditor = document.getElementById('btn-open-from-webdav-editor');
  const btnOpenRemoteReader = document.getElementById('btn-open-remote-reader');
  const markdownBody = document.getElementById('markdown-body');
  const readerTabBar = document.getElementById('reader-tab-bar');
  const readerView = document.getElementById('reader-view');
  const readerScrollContainer = readerView ? readerView.querySelector('.reader-container') : null;

  const latexPreviewEl = document.getElementById('latex-preview');
  const latexPreviewViewport = document.getElementById('latex-preview-viewport');
  const latexErrorBar = document.getElementById('latex-error-bar');
  const latexFilenameInput = document.getElementById('latex-filename-input');
  const btnLatexDownloadPNG = document.getElementById('btn-latex-download-png');
  const btnLatexZoomIn = document.getElementById('btn-latex-zoom-in');
  const btnLatexZoomOut = document.getElementById('btn-latex-zoom-out');
  const btnLatexZoomReset = document.getElementById('btn-latex-zoom-reset');

  const agentsOnlyEls = document.querySelectorAll('.agents-mode-only');
  const terminalOnlyEls = document.querySelectorAll('.terminal-mode-only');
  const pagesOnlyEls = document.querySelectorAll('.pages-mode-only');
  const rssOnlyEls = document.querySelectorAll('.rss-mode-only');

  // Terminal DOM refs
  const terminalTabList = document.getElementById('terminal-tab-list');
  const terminalMain = document.getElementById('terminal-main');
  const btnTerminalNewTab = document.getElementById('btn-terminal-new-tab');
  const btnTerminalRestart = document.getElementById('btn-terminal-restart');
  const mdEditorPreviewEl = document.getElementById('md-editor-preview');
  const btnMdEditorDownloadHTML = document.getElementById('btn-md-editor-download-html');
  const mdEditorTabBar = document.getElementById('md-editor-tab-bar');
  const btnEditorNew = document.getElementById('btn-editor-new');

  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const btnSettingsCancel = document.getElementById('btn-settings-cancel');
  const btnSettingsSave = document.getElementById('btn-settings-save');
  const generalRemoteProviderEl = document.getElementById('general-remote-provider');
  const generalRemoteWebdavEl = document.getElementById('general-remote-webdav');
  const generalRemoteCloudEl = document.getElementById('general-remote-cloud');
  const settingWebdavUrl = document.getElementById('setting-webdav-url');
  const settingWebdavUsername = document.getElementById('setting-webdav-username');
  const settingWebdavPassword = document.getElementById('setting-webdav-password');
  const btnWebdavTest = document.getElementById('btn-webdav-test');
  const webdavTestResult = document.getElementById('webdav-test-result');
  const settingWebdavSshEnabled = document.getElementById('setting-webdav-ssh-enabled');
  const webdavSshFields = document.getElementById('webdav-ssh-fields');
  const settingWebdavSshHost = document.getElementById('setting-webdav-ssh-host');
  const settingWebdavSshPort = document.getElementById('setting-webdav-ssh-port');
  const settingWebdavSshUsername = document.getElementById('setting-webdav-ssh-username');
  const settingWebdavSshKey = document.getElementById('setting-webdav-ssh-key');
  const settingWebdavSshPassphrase = document.getElementById('setting-webdav-ssh-passphrase');
  const btnWebdavSshBrowseKey = document.getElementById('btn-webdav-ssh-browse-key');

  // LLM settings
  const llmProvider = document.getElementById('llm-provider');
  const llmBaseUrl = document.getElementById('llm-base-url');
  const llmApiKey = document.getElementById('llm-api-key');
  const llmModel = document.getElementById('llm-model');
  const llmModelCombobox = document.getElementById('llm-model-combobox');
  const llmModelMenu = document.getElementById('llm-model-menu');
  const llmModelHint = document.getElementById('llm-model-hint');
  const llmTemperature = document.getElementById('llm-temperature');
  const llmTemperatureVal = document.getElementById('llm-temperature-val');
  const llmMaxTokens = document.getElementById('llm-max-tokens');
  const llmTopP = document.getElementById('llm-top-p');
  const llmTopPVal = document.getElementById('llm-top-p-val');
  const btnFetchModels = document.getElementById('btn-fetch-models');
  const btnTestLLM = document.getElementById('btn-test-llm');
  const llmTestResult = document.getElementById('llm-test-result');
  // MindMap settings inputs are injected into #settings-slot-mindmap by the
  // agent's ui.html template at startup — look them up lazily at use sites
  // (settings modal open/save, which happens only after injection completes).
  const getMindmapSettingsEl = (id) => document.getElementById(id);

  // Agents settings tab (per-agent subtabs)
  const agentsSettingsRail = document.getElementById('agents-settings-rail');
  const agentsSettingsPane = document.getElementById('agents-settings-pane');
  const btnAgentsReload = document.getElementById('btn-agents-reload');
  const agentsSettingsLlmTitle = document.getElementById('agents-settings-llm-title');
  const agentsSettingsParamsCard = document.getElementById('agents-settings-params-card');
  const agentsSettingsOverrideHint = document.getElementById('agents-settings-override-hint');
  const agentsSettingsLlmHint = document.getElementById('agents-settings-llm-hint');

  // Agents tab
  const agentsEmptyState = document.getElementById('agents-empty-state');
  const agentsWorkspacePanel = document.getElementById('agents-workspace-panel');
  const agentsList = document.getElementById('agents-list');
  const agentPanelName = document.getElementById('agent-panel-name');
  const agentPanelDescription = document.getElementById('agent-panel-description');
  const agentStatusBadge = document.getElementById('agent-status-badge');
  const agentsSshWarning = document.getElementById('agents-ssh-warning');
  const agentsLlmWarning = document.getElementById('agents-llm-warning');
  const agentsLog = document.getElementById('agents-log');
  const agentsOutputHeader = document.getElementById('agents-output-header');
  const agentsOutput = document.getElementById('agents-output');
  const agentsOutputContent = document.getElementById('agents-output-content');
  const btnAgentRun = document.getElementById('btn-agent-run');
  const btnAgentCancel = document.getElementById('btn-agent-cancel');
  const btnAgentClearLog = document.getElementById('btn-agent-clear-log');
  const btnAgentCopyOutput = document.getElementById('btn-agent-copy-output');
  const btnAgentOpenInPages = document.getElementById('btn-agent-open-in-pages');
  const btnAgentOpenInEditor = document.getElementById('btn-agent-open-in-editor');
  const agentParamsAuto = document.getElementById('agent-params-auto');
  const agentUiHost = document.getElementById('agent-ui-host');

  // Pages mode
  const pagesBody = document.getElementById('pages-body');
  const pagesLoading = document.getElementById('pages-loading');
  const pagesEmptyState = document.getElementById('pages-empty-state');
  const pagesEmptyTitle = document.getElementById('pages-empty-title');
  const pagesEmptyDescription = document.getElementById('pages-empty-description');
  const pagesContentWrap = document.getElementById('pages-content-wrap');
  const btnPagesChooseFolder = document.getElementById('btn-pages-choose-folder');
  const btnPagesBack = document.getElementById('btn-pages-back');
  const btnPagesForward = document.getElementById('btn-pages-forward');
  const btnPagesRefresh = document.getElementById('btn-pages-refresh');
  const pagesBreadcrumb = document.getElementById('pages-breadcrumb');
  const pagesRootIndicator = document.getElementById('pages-root-indicator');
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
  const generalFontFamily = document.getElementById('general-font-family');
  const generalFontSize = document.getElementById('general-font-size');
  const generalUiScale = document.getElementById('general-ui-scale');

  // Pages settings (source/path settings removed — tracker auto-populates)

  const openFromWebdavModal = document.getElementById('open-from-webdav-modal');
  const openFromWebdavTitle = document.getElementById('open-from-webdav-title');
  const btnOpenFromWebdavClose = document.getElementById('btn-open-from-webdav-close');
  const btnOpenFromWebdavCancel = document.getElementById('btn-open-from-webdav-cancel');
  const btnOpenFromWebdavOpen = document.getElementById('btn-open-from-webdav-open');
  const openFromWebdavError = document.getElementById('open-from-webdav-error');
  const openFromWebdavLoading = document.getElementById('open-from-webdav-loading');
  const openFromWebdavList = document.getElementById('open-from-webdav-list');
  const webdavSaveFilename = document.getElementById('webdav-save-filename');
  const webdavBreadcrumb = document.getElementById('webdav-breadcrumb');

  // Cloud settings elements
  const settingCloudApiUrl = document.getElementById('setting-cloud-api-url');
  const settingCloudAgentsBaseUrl = document.getElementById('setting-cloud-agents-base-url');
  const settingCloudAgentsToken = document.getElementById('setting-cloud-agents-token');
  const settingCloudEmail = document.getElementById('setting-cloud-email');
  const settingCloudPassword = document.getElementById('setting-cloud-password');
  const cloudAuthStatus = document.getElementById('cloud-auth-status');
  const btnCloudRegister = document.getElementById('btn-cloud-register');
  const btnCloudLogin = document.getElementById('btn-cloud-login');
  const btnCloudLogout = document.getElementById('btn-cloud-logout');
  const btnCloudTest = document.getElementById('btn-cloud-test');
  const cloudTestResult = document.getElementById('cloud-test-result');
  const settingCloudOldPassword = document.getElementById('setting-cloud-old-password');
  const settingCloudNewPassword = document.getElementById('setting-cloud-new-password');
  const btnCloudChangePassword = document.getElementById('btn-cloud-change-password');
  const cloudChangePasswordResult = document.getElementById('cloud-change-password-result');

  const statusToast = document.getElementById('status-toast');

  const findBar = document.getElementById('find-bar');
  const findInput = document.getElementById('find-input');
  const findCaseSensitive = document.getElementById('find-case-sensitive');
  const findMatchCount = document.getElementById('find-match-count');
  const btnFindPrev = document.getElementById('btn-find-prev');
  const btnFindNext = document.getElementById('btn-find-next');
  const btnFindClose = document.getElementById('btn-find-close');

  // ── Mode switching ──

  function switchEditorSubMode(subMode) {
    currentEditorSubMode = subMode;

    editorSubmodeTabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.editorSubmode === subMode);
    });

    mermaidSubmodeEls.forEach((el) => {
      el.classList.toggle('hidden', subMode !== 'mermaid');
    });
    latexSubmodeEls.forEach((el) => {
      el.classList.toggle('hidden', subMode !== 'latex');
    });
    mdEditorSubmodeEls.forEach((el) => {
      el.classList.toggle('hidden', subMode !== 'md-editor');
    });

    if (subMode === 'mermaid') {
      if (editor) editor.refresh();
      renderDiagram();
    } else if (subMode === 'latex') {
      if (latexEditor) latexEditor.refresh();
      renderLatex();
    } else if (subMode === 'md-editor') {
      if (mdEditor) mdEditor.refresh();
    }
  }

  function switchMode(mode) {
    currentMode = mode;

    modeTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    readerOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'reader');
    });

    editorOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'editor');
    });

    agentsOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'agents');
    });

    terminalOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'terminal');
    });

    pagesOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'pages');
    });

    rssOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', mode !== 'rss');
    });

    if (mode === 'pages' && !_pagesInitialized) {
      pagesInit();
    }

    if (mode === 'terminal') {
      initTerminal();
    }

    if (mode === 'rss') {
      initRss();
    }

    if (mode === 'editor') {
      switchEditorSubMode(currentEditorSubMode);
    }
  }

  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  editorSubmodeTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchEditorSubMode(tab.dataset.editorSubmode));
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

  function withTimeout(promise, ms, timeoutMessage) {
    let timer = null;
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(timeoutMessage || 'Operation timed out.'));
      }, ms);

      Promise.resolve(promise)
        .then(resolve, reject)
        .finally(() => {
          if (timer) clearTimeout(timer);
        });
    });
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

  // Tracks the in-flight LaTeX PNG export so (a) rapid clicks don't stack
  // iframes, and (b) beforeunload / a safety watchdog can dispose a stuck
  // export. An orphan iframe is its own renderer process with its own
  // /dev/shm footprint, so leaving one around is real.
  let _latexExportInflight = null;

  function _cleanupLatexExport(reason) {
    const ex = _latexExportInflight;
    if (!ex) return;
    _latexExportInflight = null;
    if (ex.watchdog) { try { clearTimeout(ex.watchdog); } catch (_) {} }
    if (ex.prepT) { try { clearTimeout(ex.prepT); } catch (_) {} }
    try { if (ex.wrapper && ex.wrapper.parentNode) ex.wrapper.parentNode.removeChild(ex.wrapper); } catch (_) {}
    try { if (ex.iframe && ex.iframe.parentNode) ex.iframe.parentNode.removeChild(ex.iframe); } catch (_) {}
    if (reason === 'timeout') {
      try { showLatexError('PNG export timed out.'); } catch (_) {}
    }
  }

  btnLatexDownloadPNG.addEventListener('click', () => {
    if (_latexExportInflight) return;
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

    _latexExportInflight = { wrapper, iframe, prepT: null, watchdog: null };
    _latexExportInflight.watchdog = setTimeout(() => _cleanupLatexExport('timeout'), 10000);

    _latexExportInflight.prepT = setTimeout(() => {
      if (!_latexExportInflight) return;
      _latexExportInflight.prepT = null;
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
          _cleanupLatexExport('done');
        }, 'image/png');
      };
      img.onerror = () => {
        showLatexError('Failed to export PNG.');
        _cleanupLatexExport('error');
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

    const stripped = maybeStripFrontMatter(code);
    const { cleaned, blocks: mathBlocks } = extractMath(stripped);
    if (mathBlocks.length) await ensureKatex();
    let html = marked.parse(cleaned);
    html = restoreMath(html, mathBlocks);
    mdEditorPreviewEl.innerHTML = html;
    await renderMermaidBlocks(mdEditorPreviewEl);
    renderMindmapVizBlocks(mdEditorPreviewEl);

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

  const markedRenderer = new marked.Renderer();
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

  // ── Math (LaTeX) extraction / restoration for Markdown rendering ──
  // Pre-process: pull math out before marked.parse() to prevent mangling.
  // Post-process: render each block with KaTeX and splice back into HTML.

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

  async function renderMarkdownProgressive(content, targetEl) {
    targetEl = targetEl || markdownBody;
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
    if (content.length < RENDER_VIRTUAL_THRESHOLD) {
      await ensureMermaid();
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      });
      await renderMermaidBlocks(targetEl);
    }
    renderMindmapVizBlocks(targetEl);
  }

  async function renderMarkdown(content, targetEl) {
    targetEl = targetEl || markdownBody;

    if (content && content.length > RENDER_PROGRESSIVE_THRESHOLD) {
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
    renderMindmapVizBlocks(targetEl);
  }

  function renderPlainText(content, targetEl) {
    targetEl = targetEl || markdownBody;
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

  function _cancelPdfRenderTasks(pdf) {
    const tracked = pdf && pdf._madRenderTasks;
    if (!tracked) return;
    for (const task of tracked) {
      try { task.cancel(); } catch (_) {}
    }
    tracked.clear();
  }

  async function renderPdfPage(pdf, pageNum, placeholder, viewport) {
    const page = await pdf.getPage(pageNum);
    const vp = viewport || page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    // Track the render task on the doc so tab-switch teardown can cancel it
    // before destroy(); otherwise the canvas + its /dev/shm fd stays alive
    // until the promise settles naturally (which it won't if the DOM is gone).
    const task = page.render({ canvasContext: ctx, viewport: vp });
    const tracked = pdf._madRenderTasks;
    if (tracked) tracked.add(task);
    try {
      await task.promise;
      placeholder.innerHTML = '';
      placeholder.appendChild(canvas);
      placeholder.classList.remove('pdf-page-placeholder');
    } finally {
      if (tracked) tracked.delete(task);
    }
  }

  async function renderPdf(base64Data, targetEl) {
    targetEl = targetEl || markdownBody;
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      targetEl.innerHTML = '<p style="color:var(--text-secondary)">PDF viewer is loading, please try again in a moment.</p>';
      return;
    }
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    pdf._madRenderTasks = new Set();
    const container = document.createElement('div');
    container.className = 'pdf-viewer-container';

    // Create placeholder divs for all pages
    const placeholders = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const placeholder = document.createElement('div');
      placeholder.className = 'pdf-page-placeholder';
      placeholder.dataset.pageNum = i;
      placeholder.style.width = '100%';
      placeholder.style.maxWidth = '816px';
      placeholder.style.aspectRatio = '8.5 / 11';
      placeholder.textContent = 'Page ' + i;
      container.appendChild(placeholder);
      placeholders.push(placeholder);
    }

    targetEl.innerHTML = '';
    targetEl.appendChild(container);

    // Render first page immediately to get actual dimensions
    const firstPage = await pdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1.5 });

    // Update all placeholder dimensions with actual ratio
    for (const p of placeholders) {
      p.style.aspectRatio = firstViewport.width + ' / ' + firstViewport.height;
      p.style.maxWidth = firstViewport.width + 'px';
    }

    // Render first page canvas
    await renderPdfPage(pdf, 1, placeholders[0], firstViewport);

    // Track the doc unconditionally so single-page PDFs also get destroy()'d
    // on tab switch/close; otherwise pdf.js holds the worker + shmem buffers
    // for the lifetime of the renderer.
    targetEl._pdfDoc = pdf;

    // IntersectionObserver for lazy rendering of remaining pages
    if (pdf.numPages > 1) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !entry.target.dataset.rendered) {
            entry.target.dataset.rendered = 'true';
            const pageNum = parseInt(entry.target.dataset.pageNum, 10);
            renderPdfPage(pdf, pageNum, entry.target).catch(() => {});
            observer.unobserve(entry.target);
          }
        }
      }, {
        root: readerScrollContainer,
        rootMargin: '200% 0px',
      });

      for (let i = 1; i < placeholders.length; i++) {
        observer.observe(placeholders[i]);
      }

      targetEl._pdfObserver = observer;
    }
  }

  // ════════════════════════════════════════════
  //  Virtual Text Renderer (large plain-text files)
  // ════════════════════════════════════════════

  const VTR_LINE_HEIGHT = 20;          // px — fixed, enforced by CSS
  const VTR_BUFFER_LINES = 100;        // extra lines above/below viewport
  const VTR_MAX_LINE_DISPLAY = 10000;  // truncate lines longer than this in display

  class VirtualTextRenderer {
    constructor(scrollContainer, contentEl, rawText) {
      this._scrollContainer = scrollContainer;
      this._contentEl = contentEl;
      this._rawText = rawText;
      this._lines = null;
      this._lineCount = 0;
      this._totalHeight = 0;
      this._renderedRange = { start: -1, end: -1 };
      this._wrapperEl = null;
      this._viewportEl = null;
      this._codeEl = null;
      this._scrollRAF = null;
      this._onScrollBound = this._onScroll.bind(this);
      this._attached = false;
      this._searchResults = [];
      this._searchHighlightIndex = -1;
    }

    async attach() {
      this._contentEl.innerHTML =
        '<div class="virtual-text-loading" style="padding:24px;color:var(--text-secondary)">' +
        'Processing file...</div>';

      await this._initLines();

      this._wrapperEl = document.createElement('div');
      this._wrapperEl.className = 'virtual-text-wrapper';
      this._wrapperEl.style.height = this._totalHeight + 'px';

      this._viewportEl = document.createElement('div');
      this._viewportEl.className = 'virtual-text-viewport';

      const pre = document.createElement('pre');
      pre.className = 'reader-plaintext virtual-text-pre';
      this._codeEl = document.createElement('code');
      pre.appendChild(this._codeEl);
      this._viewportEl.appendChild(pre);
      this._wrapperEl.appendChild(this._viewportEl);

      this._contentEl.innerHTML = '';
      this._contentEl.appendChild(this._wrapperEl);

      this._scrollContainer.addEventListener('scroll', this._onScrollBound, { passive: true });
      this._attached = true;
      this._updateVisibleRange();
    }

    detach() {
      if (!this._attached) return;
      this._scrollContainer.removeEventListener('scroll', this._onScrollBound);
      if (this._scrollRAF) { cancelAnimationFrame(this._scrollRAF); this._scrollRAF = null; }
      this._attached = false;
    }

    destroy() {
      this.detach();
      this._rawText = null;
      this._lines = null;
      this._wrapperEl = null;
      this._viewportEl = null;
      this._codeEl = null;
      this._searchResults = [];
    }

    scrollTo(y) {
      this._scrollContainer.scrollTop = y;
      this._updateVisibleRange();
    }

    scrollToLine(lineNum) {
      const y = lineNum * VTR_LINE_HEIGHT - this._scrollContainer.clientHeight / 3;
      this.scrollTo(Math.max(0, y));
    }

    getLineCount() { return this._lineCount; }

    getVisibleRange() {
      const scrollTop = this._scrollContainer.scrollTop;
      const viewportHeight = this._scrollContainer.clientHeight;
      return {
        startLine: Math.floor(scrollTop / VTR_LINE_HEIGHT),
        endLine: Math.ceil((scrollTop + viewportHeight) / VTR_LINE_HEIGHT),
      };
    }

    searchLines(query, caseSensitive) {
      const results = [];
      if (!query || !this._lines) return results;
      const searchStr = caseSensitive ? query : query.toLowerCase();

      for (let i = 0; i < this._lines.length; i++) {
        const line = caseSensitive ? this._lines[i] : this._lines[i].toLowerCase();
        let col = 0;
        while ((col = line.indexOf(searchStr, col)) !== -1) {
          results.push({ line: i, col, length: query.length });
          col += 1;
        }
      }
      return results;
    }

    highlightMatch(matchIndex) {
      if (matchIndex < 0 || matchIndex >= this._searchResults.length) return;
      this._searchHighlightIndex = matchIndex;
      const match = this._searchResults[matchIndex];
      this.scrollToLine(match.line);
      // After scrolling triggers re-render, highlight the specific match
      requestAnimationFrame(() => this._applySearchHighlight());
    }

    _applySearchHighlight() {
      if (!this._codeEl || this._searchHighlightIndex < 0) return;
      // Remove any existing highlights
      this._codeEl.querySelectorAll('.find-highlight').forEach((el) => {
        el.replaceWith(el.textContent);
      });

      const match = this._searchResults[this._searchHighlightIndex];
      if (!match) return;

      const { start, end } = this._renderedRange;
      if (match.line < start || match.line >= end) return;

      // Find the text node for this line in the code element
      const text = this._codeEl.textContent;
      const lineInSlice = match.line - start;
      let charOffset = 0;
      for (let i = 0; i < lineInSlice; i++) {
        charOffset = text.indexOf('\n', charOffset) + 1;
      }
      charOffset += match.col;

      // Use Range API to wrap the match
      const range = document.createRange();
      const walker = document.createTreeWalker(this._codeEl, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      let offset = 0;
      while (node) {
        const len = node.textContent.length;
        if (offset + len > charOffset) {
          const localStart = charOffset - offset;
          range.setStart(node, localStart);
          // Find end point
          let endOffset = charOffset + match.length;
          while (node && offset + node.textContent.length < endOffset) {
            offset += node.textContent.length;
            node = walker.nextNode();
          }
          if (node) {
            range.setEnd(node, endOffset - offset);
          }
          break;
        }
        offset += len;
        node = walker.nextNode();
      }

      const highlight = document.createElement('span');
      highlight.className = 'find-highlight find-highlight-active';
      try { range.surroundContents(highlight); } catch (_) { /* cross-node range */ }
    }

    async _initLines() {
      if (this._rawText.length > 50 * 1024 * 1024) {
        // Chunk-split for very large files to avoid blocking main thread
        this._lines = [];
        let pos = 0;
        while (pos < this._rawText.length) {
          const chunkEnd = Math.min(pos + 5 * 1024 * 1024, this._rawText.length);
          let splitAt = this._rawText.indexOf('\n', chunkEnd);
          if (splitAt === -1) splitAt = this._rawText.length;
          else splitAt += 1;

          const chunkLines = this._rawText.substring(pos, splitAt).split('\n');
          if (splitAt < this._rawText.length && chunkLines.length > 0 && chunkLines[chunkLines.length - 1] === '') {
            chunkLines.pop();
          }
          this._lines.push(...chunkLines);
          pos = splitAt;
          await new Promise((r) => setTimeout(r, 0));
        }
      } else {
        this._lines = this._rawText.split('\n');
      }
      this._lineCount = this._lines.length;
      this._totalHeight = this._lineCount * VTR_LINE_HEIGHT;
    }

    _onScroll() {
      if (this._scrollRAF) return;
      this._scrollRAF = requestAnimationFrame(() => {
        this._scrollRAF = null;
        this._updateVisibleRange();
      });
    }

    _updateVisibleRange() {
      if (!this._attached || !this._lines) return;
      const scrollTop = this._scrollContainer.scrollTop;
      const viewportHeight = this._scrollContainer.clientHeight;

      const firstVisible = Math.floor(scrollTop / VTR_LINE_HEIGHT);
      const lastVisible = Math.ceil((scrollTop + viewportHeight) / VTR_LINE_HEIGHT);

      const renderStart = Math.max(0, firstVisible - VTR_BUFFER_LINES);
      const renderEnd = Math.min(this._lineCount, lastVisible + VTR_BUFFER_LINES);

      // Hysteresis: skip re-render if >50% buffer remains on both sides
      if (this._renderedRange.start >= 0) {
        const bufferAbove = firstVisible - this._renderedRange.start;
        const bufferBelow = this._renderedRange.end - lastVisible;
        if (bufferAbove > VTR_BUFFER_LINES * 0.3 && bufferBelow > VTR_BUFFER_LINES * 0.3) return;
      }

      this._renderRange(renderStart, renderEnd);
    }

    _renderRange(start, end) {
      const slice = this._lines.slice(start, end);
      // Truncate very long lines to prevent layout thrashing
      const display = slice.map((line) =>
        line.length > VTR_MAX_LINE_DISPLAY
          ? line.substring(0, VTR_MAX_LINE_DISPLAY) + ' ... [line truncated]'
          : line
      );

      this._viewportEl.style.top = (start * VTR_LINE_HEIGHT) + 'px';
      this._codeEl.textContent = display.join('\n');
      this._renderedRange = { start, end };
    }
  }

  // ════════════════════════════════════════════
  //  MindMap Visualization Renderer
  // ════════════════════════════════════════════

  const MINDMAP_THREAD_COLORS = [
    '#6366f1', // indigo
    '#06b6d4', // cyan
    '#f59e0b', // amber
    '#10b981', // emerald
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  const MINDMAP_NODE_W = 180;
  const MINDMAP_NODE_H = 64;
  const MINDMAP_NODE_SPACING = 230;
  const MINDMAP_LANE_PAD_LEFT = 180;
  const MINDMAP_BRANCH_OFFSET_Y = 80;
  const MINDMAP_LANE_BASE_HEIGHT = 140;
  const MINDMAP_BRANCH_GAP = 20;
  const MINDMAP_LABEL_ROW_H = 28;
  const MINDMAP_NODE_GAP = 20;

  class MindmapVizRenderer {
    constructor(containerEl, data) {
      this._container = containerEl;
      this._data = data;
      this._svg = null;
      this._contentGroup = null;
      this._nodePositions = new Map(); // path -> {x, y, thread}
    }

    render() {
      const d3 = window.d3;
      if (!d3) {
        this._container.innerHTML = '<p style="color:var(--text-secondary)">d3.js is required for mind map visualization.</p>';
        return;
      }

      const { threads, connections, title, greeting, generatedAt, stats } = this._data;
      if (!threads || threads.length === 0) {
        this._container.innerHTML = '<p style="color:var(--text-secondary)">No threads to visualize.</p>';
        return;
      }

      // Calculate layout dimensions
      this._layoutNodes(threads);
      const maxX = this._getMaxX() + MINDMAP_NODE_W + 80;
      const lastLane = this._laneYPositions[this._laneYPositions.length - 1] || { labelY: 80 };
      const totalHeight = lastLane.labelY + MINDMAP_LANE_BASE_HEIGHT + 80;
      const vbW = Math.max(maxX, 800);
      const vbH = Math.max(totalHeight, 400);

      // Create container — disconnect any prior observer before wiping the DOM.
      if (this._container._mindmapResizeObserver) {
        this._container._mindmapResizeObserver.disconnect();
        this._container._mindmapResizeObserver = null;
      }
      this._container.innerHTML = '';
      this._container.classList.add('mindmap-viz-container');
      this._container.classList.add('is-poster');
      this._container.classList.remove('is-fullscreen', 'is-interactive');

      // Header
      const header = document.createElement('div');
      header.className = 'mindmap-viz-header';
      const metaItems = [];
      if (generatedAt) {
        metaItems.push('<span class="mindmap-viz-meta-item mindmap-viz-date">' + this._escHtml(generatedAt) + '</span>');
      }
      if (stats && typeof stats.totalFiles === 'number') {
        metaItems.push('<span class="mindmap-viz-meta-item">' + stats.totalFiles + ' files</span>');
      }
      if (stats && typeof stats.changedCount === 'number' && stats.changedCount > 0) {
        metaItems.push('<span class="mindmap-viz-meta-item">' + stats.changedCount + ' new</span>');
      }
      header.innerHTML =
        '<div class="mindmap-viz-kicker">Mind Map</div>' +
        '<h2 class="mindmap-viz-title">' + this._escHtml(title || 'Your Knowledge Map') + '</h2>' +
        (greeting ? '<p class="mindmap-viz-subtitle">' + this._escHtml(greeting) + '</p>' : '') +
        (metaItems.length ? '<div class="mindmap-viz-meta">' + metaItems.join('') + '</div>' : '');
      this._container.appendChild(header);

      // Stage — wraps the SVG so aspect-ratio scaling is isolated from controls.
      const stage = document.createElement('div');
      stage.className = 'mindmap-viz-stage';
      stage.style.setProperty('--viz-aspect', `${vbW} / ${vbH}`);
      this._container.appendChild(stage);
      this._stage = stage;

      // SVG — no fixed pixel height; CSS aspect-ratio keeps content proportional
      // as the stage widens via the Pages breakout.
      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('class', 'mindmap-viz-svg');
      svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      stage.appendChild(svgEl);
      this._svg = d3.select(svgEl);

      // Defs — glow filter
      const defs = this._svg.append('defs');
      const glowFilter = defs.append('filter').attr('id', 'mindmap-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
      glowFilter.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d) => d);

      // Zoom group
      this._contentGroup = this._svg.append('g').attr('class', 'mindmap-viz-content');

      // Prepare zoom behavior but DO NOT bind it yet — the chart starts as a
      // static poster that fits within the reading column. Binding happens on
      // first click in _activate().
      this._zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          this._contentGroup.attr('transform', event.transform);
        });

      // Render threads
      threads.forEach((thread, i) => {
        this._renderThread(thread, i);
      });

      // Render cross-thread connections
      this._renderConnections(connections || [], threads);

      // Poster overlay — visual affordance that the static image is clickable.
      this._mountPoster();
    }

    _activate() {
      if (this._container.classList.contains('is-interactive')) return;
      const d3 = window.d3;
      if (!d3 || !this._svg || !this._zoom) return;

      this._container.classList.remove('is-poster');
      this._container.classList.add('is-interactive');

      if (this._poster) {
        this._poster.remove();
        this._poster = null;
      }

      this._svg.call(this._zoom);
      const zoom = this._zoom;

      // Floating controls — back-to-preview + zoom in/out/fit.
      const controls = document.createElement('div');
      controls.className = 'mindmap-viz-controls';
      controls.innerHTML = [
        '<button type="button" class="mindmap-viz-ctrl mindmap-viz-ctrl--back" data-act="back" title="Back to preview" aria-label="Back to preview">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 6 10l6 6"/></svg>',
        '<span class="mindmap-viz-ctrl-label">Back to preview</span>',
        '</button>',
        '<span class="mindmap-viz-ctrl-divider" aria-hidden="true"></span>',
        '<button type="button" class="mindmap-viz-ctrl" data-act="zoom-in" title="Zoom in" aria-label="Zoom in">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>',
        '</button>',
        '<button type="button" class="mindmap-viz-ctrl" data-act="zoom-out" title="Zoom out" aria-label="Zoom out">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="10" x2="16" y2="10"/></svg>',
        '</button>',
        '<button type="button" class="mindmap-viz-ctrl" data-act="fit" title="Reset view" aria-label="Reset view">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M16 7V4h-3M4 13v3h3M16 13v3h-3"/></svg>',
        '</button>',
      ].join('');
      controls.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.mindmap-viz-ctrl');
        if (!btn) return;
        const act = btn.dataset.act;
        const svgSel = this._svg;
        if (act === 'zoom-in') {
          svgSel.transition().duration(180).call(zoom.scaleBy, 1.3);
        } else if (act === 'zoom-out') {
          svgSel.transition().duration(180).call(zoom.scaleBy, 1 / 1.3);
        } else if (act === 'fit') {
          svgSel.transition().duration(220).call(zoom.transform, d3.zoomIdentity);
        } else if (act === 'back') {
          this._deactivate();
        }
      });
      this._container.appendChild(controls);
      this._controls = controls;

      // Interactive mode takes over the viewport — entering fullscreen is part
      // of the activation so the chart has room to be explored.
      this._enterFullscreen();
    }

    _deactivate() {
      if (!this._container.classList.contains('is-interactive')) return;

      if (this._container.classList.contains('is-fullscreen')) {
        this._exitFullscreen();
      }

      if (this._svg && this._zoom) {
        this._svg.on('.zoom', null);
        if (this._contentGroup) this._contentGroup.attr('transform', null);
      }

      if (this._controls) {
        this._controls.remove();
        this._controls = null;
      }

      // Clear any inline breakout styles and observers that may have been
      // applied during a prior (legacy) interactive-only path.
      this._container.style.width = '';
      this._container.style.maxWidth = '';
      this._container.style.marginLeft = '';
      if (this._container._mindmapResizeObserver) {
        this._container._mindmapResizeObserver.disconnect();
        this._container._mindmapResizeObserver = null;
      }

      this._container.classList.remove('is-interactive');
      this._container.classList.add('is-poster');

      this._mountPoster();
    }

    _mountPoster() {
      if (this._poster) return;
      const poster = document.createElement('button');
      poster.type = 'button';
      poster.className = 'mindmap-viz-poster';
      poster.setAttribute('aria-label', 'Activate interactive mind map');
      poster.innerHTML = [
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--tl"></span>',
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--tr"></span>',
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--bl"></span>',
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--br"></span>',
        '<span class="mindmap-viz-poster-cta">',
        '<span class="mindmap-viz-poster-cta-icon" aria-hidden="true">',
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
        '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
        '</svg>',
        '</span>',
        '<span class="mindmap-viz-poster-cta-label">',
        '<span class="mindmap-viz-poster-cta-eyebrow">Preview</span>',
        '<span class="mindmap-viz-poster-cta-text">Click to explore</span>',
        '</span>',
        '</span>',
      ].join('');
      poster.addEventListener('click', () => this._activate());
      this._container.appendChild(poster);
      this._poster = poster;
    }

    _applyPagesBreakout() {
      const contentWrap = this._container.closest('.pages-content-wrap');
      if (!contentWrap) return;
      const recompute = () => {
        if (this._container.classList.contains('is-fullscreen')) return;
        const parent = this._container.parentElement;
        if (!parent) return;
        const wrapRect = contentWrap.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const pad = 20;
        const targetW = Math.max(wrapRect.width - pad * 2, 400);
        const leftOffset = wrapRect.left - parentRect.left + pad;
        this._container.style.width = targetW + 'px';
        this._container.style.maxWidth = targetW + 'px';
        this._container.style.marginLeft = leftOffset + 'px';
      };
      recompute();
      const ro = new ResizeObserver(recompute);
      ro.observe(contentWrap);
      this._container._mindmapResizeObserver = ro;
    }

    _enterFullscreen() {
      const el = this._container;
      if (el.classList.contains('is-fullscreen')) return;
      el.classList.add('is-fullscreen');
      el.style.width = '';
      el.style.maxWidth = '';
      el.style.marginLeft = '';
      document.body.classList.add('mindmap-viz-fullscreen-lock');
      this._escHandler = (ev) => {
        if (ev.key === 'Escape') this._deactivate();
      };
      window.addEventListener('keydown', this._escHandler);
      if (this._svg && this._zoom && window.d3) {
        this._svg.transition().duration(180).call(this._zoom.transform, window.d3.zoomIdentity);
      }
    }

    _exitFullscreen() {
      const el = this._container;
      if (!el.classList.contains('is-fullscreen')) return;
      el.classList.remove('is-fullscreen');
      document.body.classList.remove('mindmap-viz-fullscreen-lock');
      if (this._escHandler) {
        window.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
    }

    _layoutNodes(threads) {
      this._nodePositions.clear();
      this._laneYPositions = []; // each entry: { labelY, cardY }

      let currentY = 80;

      for (let threadIdx = 0; threadIdx < threads.length; threadIdx++) {
        const labelY = currentY;
        const cardY = currentY + MINDMAP_LABEL_ROW_H;
        this._laneYPositions.push({ labelY, cardY });

        const items = threads[threadIdx].items || [];
        const mainItems = items.filter((i) => !i.parentPath);
        const branchItems = items.filter((i) => i.parentPath);

        // Layout main-line items
        mainItems.forEach((item, idx) => {
          const x = MINDMAP_LANE_PAD_LEFT + idx * MINDMAP_NODE_SPACING;
          this._nodePositions.set(item.path, { x, y: cardY, threadIdx, isBranch: false });
        });

        // Group branches by parent, stagger horizontally
        const branchesByParent = new Map();
        for (const item of branchItems) {
          const list = branchesByParent.get(item.parentPath) || [];
          list.push(item);
          branchesByParent.set(item.parentPath, list);
        }

        let hasBranches = false;
        for (const [parentPath, siblings] of branchesByParent) {
          const parent = this._nodePositions.get(parentPath);
          if (!parent) {
            siblings.forEach((item, i) => {
              const x = MINDMAP_LANE_PAD_LEFT + (mainItems.length + i) * MINDMAP_NODE_SPACING;
              this._nodePositions.set(item.path, { x, y: cardY, threadIdx, isBranch: false });
            });
            continue;
          }
          hasBranches = true;
          siblings.forEach((item, i) => {
            const x = parent.x + (i + 1) * (MINDMAP_NODE_W + MINDMAP_BRANCH_GAP);
            const y = parent.y + MINDMAP_BRANCH_OFFSET_Y;
            this._nodePositions.set(item.path, { x, y, threadIdx, isBranch: true });
          });
        }

        // Collision sweep — resolve any remaining horizontal overlaps within this lane
        this._resolveCollisions(items);

        // Advance Y: label row + card rows + padding
        const laneHeight = MINDMAP_LABEL_ROW_H + (hasBranches
          ? MINDMAP_NODE_H + MINDMAP_BRANCH_OFFSET_Y + MINDMAP_NODE_H + 40
          : MINDMAP_NODE_H + 60);
        currentY += Math.max(laneHeight, MINDMAP_LANE_BASE_HEIGHT);
      }
    }

    _resolveCollisions(items) {
      // Collect all positioned rects for this lane, grouped by Y row
      const rowMap = new Map(); // y -> [{path, x}]
      for (const item of items) {
        const pos = this._nodePositions.get(item.path);
        if (!pos) continue;
        const row = rowMap.get(pos.y) || [];
        row.push({ path: item.path, x: pos.x });
        rowMap.set(pos.y, row);
      }

      for (const [, row] of rowMap) {
        row.sort((a, b) => a.x - b.x);
        for (let i = 1; i < row.length; i++) {
          const prevRight = row[i - 1].x + MINDMAP_NODE_W + MINDMAP_NODE_GAP;
          if (row[i].x < prevRight) {
            row[i].x = prevRight;
            const pos = this._nodePositions.get(row[i].path);
            pos.x = prevRight;
          }
        }
      }
    }

    _getMaxX() {
      let max = 0;
      for (const pos of this._nodePositions.values()) {
        if (pos.x > max) max = pos.x;
      }
      return max;
    }

    _renderThread(thread, threadIdx) {
      const d3 = window.d3;
      const color = MINDMAP_THREAD_COLORS[threadIdx % MINDMAP_THREAD_COLORS.length];
      const lanePos = this._laneYPositions[threadIdx];
      const g = this._contentGroup.append('g').attr('class', 'thread-lane').attr('data-thread', thread.title);

      // Collect main-line node positions for the river path
      const mainPositions = [];
      for (const item of thread.items || []) {
        const pos = this._nodePositions.get(item.path);
        if (pos && !pos.isBranch) {
          mainPositions.push(pos);
        }
      }

      // Draw river path (flowing bezier through main nodes)
      if (mainPositions.length >= 2) {
        const riverPoints = mainPositions.map((p) => [p.x + MINDMAP_NODE_W / 2, p.y + MINDMAP_NODE_H / 2]);
        // Extend river beyond first and last nodes
        const first = riverPoints[0];
        const last = riverPoints[riverPoints.length - 1];
        const extended = [[first[0] - 60, first[1]], ...riverPoints, [last[0] + 60, last[1]]];

        const line = d3.line().curve(d3.curveBasis);
        g.append('path')
          .attr('class', 'thread-river')
          .attr('d', line(extended))
          .attr('stroke', color)
          .attr('stroke-width', Math.max(3, Math.min(thread.items.length * 2, 12)));
      } else if (mainPositions.length === 1) {
        const p = mainPositions[0];
        g.append('line')
          .attr('class', 'thread-river')
          .attr('x1', p.x - 30).attr('y1', p.y + MINDMAP_NODE_H / 2)
          .attr('x2', p.x + MINDMAP_NODE_W + 30).attr('y2', p.y + MINDMAP_NODE_H / 2)
          .attr('stroke', color).attr('stroke-width', 4);
      }

      // Thread label — dedicated row above cards
      g.append('text')
        .attr('class', 'thread-label')
        .attr('x', 16)
        .attr('y', lanePos.labelY + 16)
        .attr('fill', color)
        .text(thread.title);

      // Draw branch lines
      for (const item of thread.items || []) {
        if (!item.parentPath) continue;
        const childPos = this._nodePositions.get(item.path);
        const parentPos = this._nodePositions.get(item.parentPath);
        if (!childPos || !parentPos) continue;

        const x1 = parentPos.x + MINDMAP_NODE_W / 2;
        const y1 = parentPos.y + MINDMAP_NODE_H;
        const x2 = childPos.x + MINDMAP_NODE_W / 2;
        const y2 = childPos.y;
        const midY = (y1 + y2) / 2;

        g.append('path')
          .attr('class', 'branch-line')
          .attr('d', `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`)
          .attr('stroke', color);
      }

      // Draw node cards
      for (const item of thread.items || []) {
        const pos = this._nodePositions.get(item.path);
        if (!pos) continue;
        this._renderNodeCard(g, item, pos, color);
      }
    }

    _renderNodeCard(parentGroup, item, pos, color) {
      const d3 = window.d3;
      const g = parentGroup.append('g')
        .attr('class', 'node-card')
        .attr('data-path', item.path)
        .attr('transform', `translate(${pos.x},${pos.y})`)
        .style('cursor', 'pointer');

      // Card background
      g.append('rect')
        .attr('rx', 8).attr('ry', 8)
        .attr('width', MINDMAP_NODE_W).attr('height', MINDMAP_NODE_H)
        .attr('stroke', color).attr('stroke-opacity', 0.6);

      // Importance dot
      const dotColor = item.importance === 'high' ? '#22c55e' : item.importance === 'medium' ? '#eab308' : '#6b7280';
      g.append('circle')
        .attr('cx', MINDMAP_NODE_W - 14).attr('cy', 14)
        .attr('r', 4).attr('fill', dotColor);

      // Title
      const titleText = this._truncate(item.title || '', 22);
      g.append('text')
        .attr('class', 'node-title')
        .attr('x', 12).attr('y', 24)
        .text(titleText);

      // Summary (1-line)
      const summaryText = this._truncate(item.summary || '', 32);
      g.append('text')
        .attr('class', 'node-summary')
        .attr('x', 12).attr('y', 44)
        .text(summaryText);

      // Hover tooltip with full details
      const titleEl = g.node();
      const tip = document.createElement('div');
      tip.className = 'mindmap-viz-tooltip';
      tip.innerHTML =
        '<div class="mindmap-viz-tip-title">' + this._escHtml(item.title || '') + '</div>' +
        '<div class="mindmap-viz-tip-summary">' + this._escHtml(item.summary || '') + '</div>' +
        '<div class="mindmap-viz-tip-path">' + this._escHtml(item.path || '') + '</div>';

      titleEl.addEventListener('mouseenter', () => {
        g.select('rect').attr('filter', 'url(#mindmap-glow)').attr('stroke-opacity', 1);
        this._container.appendChild(tip);
        const rect = titleEl.getBoundingClientRect();
        const containerRect = this._container.getBoundingClientRect();
        tip.style.left = (rect.left - containerRect.left + MINDMAP_NODE_W / 2 - tip.offsetWidth / 2) + 'px';
        tip.style.top = (rect.top - containerRect.top - tip.offsetHeight - 8) + 'px';
      });
      titleEl.addEventListener('mouseleave', () => {
        g.select('rect').attr('filter', null).attr('stroke-opacity', 0.6);
        if (tip.parentNode) tip.parentNode.removeChild(tip);
      });

      // Click to open file
      titleEl.addEventListener('click', () => {
        if (typeof pagesNavigate === 'function') {
          pagesNavigate(item.path, true, { type: 'file' });
        } else if (typeof pagesNavigateFromHref === 'function') {
          pagesNavigateFromHref(item.path);
        }
      });
    }

    _renderConnections(connections, threads) {
      const d3 = window.d3;
      if (!connections.length) return;
      const g = this._contentGroup.append('g').attr('class', 'cross-connections');

      const threadIndexByTitle = new Map();
      threads.forEach((t, i) => threadIndexByTitle.set(t.title, i));

      for (const conn of connections) {
        const fromIdx = threadIndexByTitle.get(conn.from);
        const toIdx = threadIndexByTitle.get(conn.to);
        if (fromIdx === undefined || toIdx === undefined || fromIdx === toIdx) continue;

        const fromY = this._laneYPositions[fromIdx].cardY + MINDMAP_NODE_H / 2;
        const toY = this._laneYPositions[toIdx].cardY + MINDMAP_NODE_H / 2;
        const x = MINDMAP_LANE_PAD_LEFT + 60;
        const midY = (fromY + toY) / 2;
        const arcX = x - 40;
        const arcD = `M${x},${fromY} Q${arcX},${midY} ${x},${toY}`;

        // Visible arc
        g.append('path')
          .attr('class', 'cross-link')
          .attr('d', arcD);

        // Invisible wider hit-area for hover
        const hitPath = g.append('path')
          .attr('d', arcD)
          .attr('fill', 'none')
          .attr('stroke', 'transparent')
          .attr('stroke-width', 16)
          .style('cursor', 'pointer');

        // Hover tooltip for insight text
        const insightText = conn.insight || '';
        if (insightText) {
          const tip = document.createElement('div');
          tip.className = 'mindmap-viz-tooltip';
          tip.innerHTML =
            '<div class="mindmap-viz-tip-title">' +
            this._escHtml(conn.from) + ' \u2194 ' + this._escHtml(conn.to) +
            '</div>' +
            '<div class="mindmap-viz-tip-summary">' + this._escHtml(insightText) + '</div>';

          const hitEl = hitPath.node();
          hitEl.addEventListener('mouseenter', () => {
            this._container.appendChild(tip);
            const rect = hitEl.getBoundingClientRect();
            const containerRect = this._container.getBoundingClientRect();
            tip.style.left = (rect.left - containerRect.left + rect.width / 2 - tip.offsetWidth / 2) + 'px';
            tip.style.top = (rect.top - containerRect.top - tip.offsetHeight - 8) + 'px';
            tip.style.opacity = '1';
          });
          hitEl.addEventListener('mouseleave', () => {
            tip.style.opacity = '0';
            if (tip.parentNode) tip.parentNode.removeChild(tip);
          });
        }
      }
    }

    _truncate(str, max) {
      if (str.length <= max) return str;
      return str.substring(0, max - 1) + '\u2026';
    }

    _escHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  function renderMindmapVizBlocks(container) {
    const blocks = container.querySelectorAll('.mindmap-viz-block');
    for (const block of blocks) {
      try {
        const jsonStr = decodeURIComponent(block.dataset.vizJson);
        const data = JSON.parse(jsonStr);
        const renderer = new MindmapVizRenderer(block, data);
        renderer.render();
      } catch (err) {
        block.innerHTML = '<p style="color:var(--text-secondary)">Failed to render mind map visualization: ' + (err.message || err) + '</p>';
      }
    }
  }

  // Exposed for standalone/test harnesses that want to mount mindmap-viz
  // blocks outside the editor preview or Pages document pipeline.
  window.__madRenderMindmapViz = renderMindmapVizBlocks;

  // ════════════════════════════════════════════
  //  Pages Mode
  // ════════════════════════════════════════════

  // Keep in sync with WEBDAV_PAGES_EXTENSIONS in main.js
  const PAGES_SUPPORTED_EXTENSIONS = [
    '.md',
    '.markdown',
    '.txt',
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
    '.ico',
    '.jpe',
    '.jfif',
  ];

  let pagesHistory = [];
  let pagesHistoryIdx = -1;
  let pagesCurrentPath = null;
  let _pagesFileList = [];
  let _pagesRootName = '';
  let _pagesInitialized = false;
  let _pagesWebdavRoot = '/';
  let _pagesCurrentDir = '/';
  let _pagesCurrentFilePath = null;

  function normalizeWebdavPath(remotePath, { directory = false } = {}) {
    const raw = String(remotePath || '/').trim();
    const parts = raw
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .reduce((acc, seg) => {
        if (seg === '.') return acc;
        if (seg === '..') {
          acc.pop();
          return acc;
        }
        acc.push(seg);
        return acc;
      }, []);
    const normalized = '/' + parts.join('/');
    if (normalized === '/') return '/';
    return directory ? normalized : normalized;
  }

  function ensureWebdavDirectoryPath(remotePath) {
    return normalizeWebdavPath(remotePath, { directory: true });
  }

  function getWebdavBasename(remotePath) {
    const normalized = normalizeWebdavPath(remotePath);
    if (normalized === '/') return '/';
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || '/';
  }

  function getWebdavDirname(remotePath) {
    const normalized = normalizeWebdavPath(remotePath);
    if (normalized === '/') return '/';
    const parts = normalized.split('/').filter(Boolean);
    parts.pop();
    return parts.length ? `/${parts.join('/')}` : '/';
  }

  function joinWebdavPath(...parts) {
    return normalizeWebdavPath(parts.filter(Boolean).join('/'));
  }

  function getMindmapSettings(settings = {}) {
    // Canonical source is `settings.agents.mindmap.params`; fall back to the
    // legacy top-level `settings.mindmap` for pre-migration saved files.
    const mm = settings?.agents?.mindmap?.params || settings?.mindmap || {};
    const scanRoot = normalizeWebdavPath(mm.scanRoot || settings?.webdav?.pagesRoot || '/');
    const outputDir = normalizeWebdavPath(
      mm.outputDir || joinWebdavPath(scanRoot, 'mindmap')
    );
    const stateFilePath = normalizeWebdavPath(
      mm.stateFilePath || joinWebdavPath(outputDir, 'mindmap-state.json')
    );
    const maxFileBytes = Number(mm.maxFileBytes);
    const parallelInference = Number(mm.parallelInference);
    const maxContextChars = Number(mm.maxContextChars);
    const restructureThreshold = Number(mm.restructureThreshold);

    return {
      scanRoot,
      outputDir,
      stateFilePath,
      maxFileBytes: Number.isFinite(maxFileBytes) && maxFileBytes > 0 ? maxFileBytes : 25 * 1024 * 1024,
      parallelInference:
        Number.isFinite(parallelInference) && parallelInference > 0
          ? Math.max(1, Math.floor(parallelInference))
          : 6,
      maxContextChars:
        Number.isFinite(maxContextChars) && maxContextChars > 0
          ? Math.max(2000, Math.floor(maxContextChars))
          : 120000,
      restructureThreshold:
        Number.isFinite(restructureThreshold) && restructureThreshold >= 0 && restructureThreshold <= 1
          ? restructureThreshold
          : 0.35,
    };
  }

  function getMindmapSettingsFromForm(existing = {}) {
    const scanRootEl = getMindmapSettingsEl('mindmap-scan-root');
    const outputDirEl = getMindmapSettingsEl('mindmap-output-dir');
    const stateFileEl = getMindmapSettingsEl('mindmap-state-file');
    const maxFileMbEl = getMindmapSettingsEl('mindmap-max-file-mb');
    const parallelInferenceEl = getMindmapSettingsEl('mindmap-parallel-inference');
    const maxContextCharsEl = getMindmapSettingsEl('mindmap-max-context-chars');
    const restructureThresholdEl = getMindmapSettingsEl('mindmap-restructure-threshold');
    const scanRoot = normalizeWebdavPath(
      scanRootEl?.value || existing?.mindmap?.scanRoot || existing?.webdav?.pagesRoot || '/'
    );
    const outputDir = normalizeWebdavPath(
      outputDirEl?.value || existing?.mindmap?.outputDir || joinWebdavPath(scanRoot, 'mindmap')
    );
    const stateFilePath = normalizeWebdavPath(
      stateFileEl?.value || existing?.mindmap?.stateFilePath || joinWebdavPath(outputDir, 'mindmap-state.json')
    );
    const maxFileMb = parseInt(maxFileMbEl?.value || '', 10);
    const parallelInference = parseInt(parallelInferenceEl?.value || '', 10);
    const maxContextChars = parseInt(maxContextCharsEl?.value || '', 10);
    const restructurePercent = parseFloat(restructureThresholdEl?.value || '');

    return {
      scanRoot,
      outputDir,
      stateFilePath,
      maxFileBytes: Number.isFinite(maxFileMb) && maxFileMb > 0 ? maxFileMb * 1024 * 1024 : 25 * 1024 * 1024,
      parallelInference:
        Number.isFinite(parallelInference) && parallelInference > 0 ? Math.max(1, parallelInference) : 6,
      maxContextChars:
        Number.isFinite(maxContextChars) && maxContextChars > 0 ? Math.max(2000, maxContextChars) : 120000,
      restructureThreshold:
        Number.isFinite(restructurePercent) && restructurePercent >= 0 && restructurePercent <= 100
          ? restructurePercent / 100
          : 0.35,
    };
  }

  function formatRemoteSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isWebdavPagesFilePath(remotePath) {
    const normalized = normalizeWebdavPath(remotePath).toLowerCase();
    return PAGES_SUPPORTED_EXTENSIONS.some((ext) => normalized.endsWith(ext));
  }

  function getPagesFileExtension(remotePath) {
    const base = getWebdavBasename(remotePath).toLowerCase();
    const i = base.lastIndexOf('.');
    return i >= 0 ? base.slice(i) : '';
  }

  function getPagesSidebarKindLabel(remotePath) {
    const ext = getPagesFileExtension(remotePath);
    if (ext === '.md' || ext === '.markdown') return 'MD';
    if (ext === '.txt') return 'TXT';
    if (ext === '.json') return 'JSON';
    if (ext === '.svg') return 'SVG';
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.jpe', '.jfif'].includes(ext))
      return 'IMG';
    return 'FILE';
  }

  function pagesEscapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function renderPagesFileContent(result, normalizedPath) {
    const ext = getPagesFileExtension(normalizedPath);
    const safeAlt = pagesEscapeHtml(getWebdavBasename(normalizedPath)).replace(/"/g, '&quot;');

    if (result.encoding === 'base64' && result.mimeType) {
      const src = `data:${result.mimeType};base64,${result.content}`;
      pagesBody.innerHTML = `<div class="pages-image-view"><img src="${src}" alt="${safeAlt}" /></div>`;
      return;
    }

    const text = typeof result.content === 'string' ? result.content : '';

    if (ext === '.svg') {
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      pagesBody.innerHTML = `<div class="pages-image-view"><img src="${src}" alt="${safeAlt}" /></div>`;
      return;
    }

    if (ext === '.md' || ext === '.markdown') {
      await renderMarkdown(text, pagesBody);
      return;
    }

    if (ext === '.txt') {
      pagesBody.innerHTML = `<pre class="pages-raw-pre">${pagesEscapeHtml(text)}</pre>`;
      return;
    }

    if (ext === '.json') {
      let display = text;
      try {
        display = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      pagesBody.innerHTML = `<pre class="pages-raw-pre">${pagesEscapeHtml(display)}</pre>`;
      return;
    }

    await renderMarkdown(text, pagesBody);
  }

  function isPathWithinPagesRoot(remotePath, rootPath = _pagesWebdavRoot) {
    const normalizedPath = normalizeWebdavPath(remotePath);
    const normalizedRoot = ensureWebdavDirectoryPath(rootPath);
    if (normalizedRoot === '/') return normalizedPath.startsWith('/');
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
  }

  function getPagesRootLabel() {
    return _pagesWebdavRoot === '/' ? 'File Space' : getWebdavBasename(_pagesWebdavRoot);
  }

  function getPagesRelativePath(remotePath) {
    const normalizedPath = normalizeWebdavPath(remotePath);
    const normalizedRoot = ensureWebdavDirectoryPath(_pagesWebdavRoot);
    if (normalizedRoot === '/') return normalizedPath === '/' ? '' : normalizedPath.slice(1);
    if (normalizedPath === normalizedRoot) return '';
    if (!normalizedPath.startsWith(`${normalizedRoot}/`)) return normalizedPath.replace(/^\//, '');
    return normalizedPath.slice(normalizedRoot.length + 1);
  }

  function getPagesDirectoryTitle(dirPath) {
    const relative = getPagesRelativePath(dirPath);
    return relative || getPagesRootLabel();
  }

  function updatePagesHistoryButtons() {
    btnPagesBack.disabled = pagesHistoryIdx <= 0;
    btnPagesForward.disabled = pagesHistoryIdx >= pagesHistory.length - 1;
  }

  function setPagesEmptyState(title, description) {
    if (pagesEmptyTitle) pagesEmptyTitle.textContent = title;
    if (pagesEmptyDescription) pagesEmptyDescription.textContent = description;
  }

  function showPagesLoadingState() {
    pagesLoading.classList.remove('hidden');
    pagesEmptyState.classList.add('hidden');
    pagesIndexView.classList.add('hidden');
    pagesContentWrap.classList.add('hidden');
  }

  function capturePagesViewState() {
    return {
      showEmpty: !pagesEmptyState.classList.contains('hidden'),
      showIndex: !pagesIndexView.classList.contains('hidden'),
      showContent: !pagesContentWrap.classList.contains('hidden'),
    };
  }

  function restorePagesViewState(viewState) {
    pagesLoading.classList.add('hidden');
    pagesEmptyState.classList.toggle('hidden', !viewState.showEmpty);
    pagesIndexView.classList.toggle('hidden', !viewState.showIndex);
    pagesContentWrap.classList.toggle('hidden', !viewState.showContent);
  }

  function showPagesEmptyState(title, description) {
    setPagesEmptyState(title, description);
    pagesLoading.classList.add('hidden');
    pagesIndexView.classList.add('hidden');
    pagesContentWrap.classList.add('hidden');
    pagesEmptyState.classList.remove('hidden');
  }

  function setPagesWebdavRoot(remotePath) {
    _pagesWebdavRoot = ensureWebdavDirectoryPath(remotePath || '/');
    _pagesRootName = getPagesRootLabel();
    if (!isPathWithinPagesRoot(_pagesCurrentDir, _pagesWebdavRoot)) {
      _pagesCurrentDir = _pagesWebdavRoot;
    }
    if (_pagesCurrentFilePath && !isPathWithinPagesRoot(_pagesCurrentFilePath, _pagesWebdavRoot)) {
      _pagesCurrentFilePath = null;
    }
    updatePagesLocationUi();
  }

  function buildPagesBreadcrumb() {
    pagesBreadcrumb.innerHTML = '';
    const appendSeparator = () => {
      const sep = document.createElement('span');
      sep.className = 'pages-breadcrumb-separator';
      sep.textContent = '/';
      pagesBreadcrumb.appendChild(sep);
    };
    const appendSegment = (label, targetPath, isCurrent, type) => {
      const seg = document.createElement('span');
      seg.className = 'pages-breadcrumb-segment' + (isCurrent ? ' current' : '');
      seg.textContent = label;
      if (!isCurrent) {
        seg.addEventListener('click', () => pagesNavigate(targetPath, true, { type }));
      }
      pagesBreadcrumb.appendChild(seg);
    };

    const currentDir = ensureWebdavDirectoryPath(_pagesCurrentDir || _pagesWebdavRoot);
    appendSegment(
      getPagesRootLabel(),
      _pagesWebdavRoot,
      !_pagesCurrentFilePath && currentDir === _pagesWebdavRoot,
      'directory'
    );

    let walkPath = _pagesWebdavRoot;
    const relativeSegments = getPagesRelativePath(currentDir).split('/').filter(Boolean);
    relativeSegments.forEach((segment) => {
      appendSeparator();
      walkPath = walkPath === '/' ? `/${segment}` : `${walkPath}/${segment}`;
      appendSegment(segment, walkPath, !_pagesCurrentFilePath && walkPath === currentDir, 'directory');
    });

    if (_pagesCurrentFilePath) {
      appendSeparator();
      appendSegment(getWebdavBasename(_pagesCurrentFilePath), _pagesCurrentFilePath, true, 'file');
    }
  }

  function updatePagesLocationUi() {
    if (pagesRootIndicator) {
      pagesRootIndicator.textContent =
        _pagesWebdavRoot === '/' ? 'File Space' : `Root: ${_pagesWebdavRoot}`;
      pagesRootIndicator.title = _pagesWebdavRoot;
    }
    pagesSidebarTitle.textContent = _pagesRootName || 'File Space';
    pagesIndexHeading.textContent = getPagesDirectoryTitle(_pagesCurrentDir || _pagesWebdavRoot);
    buildPagesBreadcrumb();
  }

  function normalizePagesListItems(items) {
    return (items || [])
      .map((item) => {
        const type = item.type === 'directory' ? 'directory' : 'file';
        const path =
          type === 'directory' ? ensureWebdavDirectoryPath(item.path) : normalizeWebdavPath(item.path);
        return {
          type,
          path,
          name: item.name,
          title: type === 'directory' ? item.name : stripFileExtension(item.name),
          size: item.size,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
  }

  function updatePagesSidebarActiveItem() {
    pagesFileTree.querySelectorAll('.pages-file-item').forEach((el) => {
      el.classList.toggle(
        'active',
        !!_pagesCurrentFilePath && el.dataset.type === 'file' && el.dataset.path === _pagesCurrentFilePath
      );
    });
  }

  function applyPagesSidebarFilter() {
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
  }

  function makePagesSidebarItem(item, options = {}) {
    const entry = document.createElement('div');
    entry.className = 'pages-file-item';
    entry.dataset.path = item.path;
    entry.dataset.title = item.title || item.name || '';
    entry.dataset.type = item.type;
    entry.title = item.path;

    const name = document.createElement('span');
    name.className = 'pages-file-item-name';
    name.textContent = options.label || item.title || item.name;
    entry.appendChild(name);

    const kind = document.createElement('span');
    kind.className = 'pages-file-item-kind';
    kind.textContent =
      options.kind ||
      (item.type === 'directory' ? 'DIR' : getPagesSidebarKindLabel(item.path));
    entry.appendChild(kind);

    entry.addEventListener('click', () => pagesNavigate(item.path, true, { type: item.type }));
    return entry;
  }

  function appendPagesSidebarSection(label, items) {
    if (!items.length) return;
    const header = document.createElement('div');
    header.className = 'pages-folder-header';
    header.innerHTML = `<span>${label}</span><span class="pages-folder-count">${items.length}</span>`;

    const filesDiv = document.createElement('div');
    filesDiv.className = 'pages-folder-files';
    items.forEach((item) => filesDiv.appendChild(makePagesSidebarItem(item)));

    header.addEventListener('click', () => filesDiv.classList.toggle('collapsed'));

    pagesFileTree.appendChild(header);
    pagesFileTree.appendChild(filesDiv);
  }

  function buildSidebar(items) {
    pagesFileTree.innerHTML = '';

    if (_pagesCurrentDir !== _pagesWebdavRoot) {
      pagesFileTree.appendChild(
        makePagesSidebarItem(
          {
            path: getWebdavDirname(_pagesCurrentDir),
            title: 'Parent folder',
            name: '..',
            type: 'directory',
          },
          { label: '..', kind: 'UP' }
        )
      );
    }

    const directories = items.filter((item) => item.type === 'directory');
    const files = items.filter((item) => item.type === 'file');
    appendPagesSidebarSection('Folders', directories);
    appendPagesSidebarSection('Pages', files);
    updatePagesSidebarActiveItem();
    applyPagesSidebarFilter();
  }

  function buildPagesIndexCard(item) {
    const card = document.createElement('div');
    card.className = 'pages-card';

    const meta = document.createElement('div');
    meta.className = 'pages-card-meta';

    const badge = document.createElement('span');
    badge.className = 'pages-card-folder';
    badge.textContent = item.type === 'directory' ? 'Folder' : 'Page';
    meta.appendChild(badge);

    if (item.type === 'file' && Number.isFinite(item.size)) {
      const sizeEl = document.createElement('span');
      sizeEl.className = 'pages-card-date';
      sizeEl.textContent = formatRemoteSize(item.size);
      meta.appendChild(sizeEl);
    }

    card.appendChild(meta);

    const title = document.createElement('div');
    title.className = 'pages-card-title';
    title.textContent = item.title || item.name;
    card.appendChild(title);

    const excerpt = document.createElement('div');
    excerpt.className = 'pages-card-excerpt';
    excerpt.textContent =
      item.type === 'directory' ? 'Browse this folder.' : `Open ${item.name || item.title}.`;
    card.appendChild(excerpt);

    card.addEventListener('click', () => pagesNavigate(item.path, true, { type: item.type }));
    return card;
  }

  function showPagesIndex() {
    pagesLoading.classList.add('hidden');
    pagesEmptyState.classList.add('hidden');
    pagesContentWrap.classList.add('hidden');
    pagesIndexView.classList.remove('hidden');
    _pagesCurrentFilePath = null;
    pagesCurrentPath = _pagesCurrentDir;
    updatePagesLocationUi();
    updatePagesSidebarActiveItem();

    pagesIndexGrid.innerHTML = '';
    if (_pagesFileList.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'pages-card pages-card-empty';
      emptyCard.innerHTML =
        '<div class="pages-card-title">This folder is empty</div><div class="pages-card-excerpt">Choose another folder or add Markdown, text, JSON, or image files to this location.</div>';
      pagesIndexGrid.appendChild(emptyCard);
      return;
    }

    _pagesFileList.forEach((item) => {
      pagesIndexGrid.appendChild(buildPagesIndexCard(item));
    });
  }

  async function fetchPagesDirectory(dirPath) {
    const normalizedDir = ensureWebdavDirectoryPath(dirPath);
    if (!isPathWithinPagesRoot(normalizedDir)) {
      return { success: false, error: 'That folder is outside the selected WebDAV root.' };
    }
    let result;
    try {
      result = await withTimeout(
        window.electronAPI.webdavListFiles({ path: normalizedDir }),
        REMOTE_REQUEST_TIMEOUT_MS,
        'Timed out loading this WebDAV folder.'
      );
    } catch (err) {
      return { success: false, error: err.message || 'Failed to load folder.' };
    }
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to load folder.' };
    }
    return {
      success: true,
      dirPath: normalizedDir,
      items: normalizePagesListItems(result.items || []),
    };
  }

  async function ensurePagesDirectoryState(dirPath, { force = false, suppressError = false } = {}) {
    const normalizedDir = ensureWebdavDirectoryPath(dirPath);
    if (!force && _pagesInitialized && _pagesCurrentDir === normalizedDir) {
      buildSidebar(_pagesFileList);
      updatePagesLocationUi();
      return true;
    }

    const result = await fetchPagesDirectory(normalizedDir);
    if (!result.success) {
      if (!suppressError) showToast(result.error || 'Failed to load folder', 'error');
      return false;
    }

    _pagesFileList = result.items;
    _pagesCurrentDir = result.dirPath;
    _pagesInitialized = true;
    buildSidebar(_pagesFileList);
    updatePagesLocationUi();
    return true;
  }

  function pushPagesHistory(type, targetPath) {
    const path = type === 'directory' ? ensureWebdavDirectoryPath(targetPath) : normalizeWebdavPath(targetPath);
    const current = pagesHistory[pagesHistoryIdx];
    if (current && current.type === type && current.path === path) {
      updatePagesHistoryButtons();
      return;
    }
    pagesHistory = pagesHistory.slice(0, pagesHistoryIdx + 1);
    pagesHistory.push({ type, path });
    pagesHistoryIdx = pagesHistory.length - 1;
    updatePagesHistoryButtons();
  }

  async function pagesLoadDirectory(dirPath, addToHistory = true, options = {}) {
    const normalizedDir = ensureWebdavDirectoryPath(dirPath);
    if (!isPathWithinPagesRoot(normalizedDir)) {
      if (!options.suppressError) {
        showToast('That folder is outside the selected WebDAV root', 'error');
      }
      return false;
    }

    const previousViewState = capturePagesViewState();
    showPagesLoadingState();
    const listed = await ensurePagesDirectoryState(normalizedDir, {
      force: true,
      suppressError: options.suppressError,
    });
    if (!listed) {
      restorePagesViewState(previousViewState);
      return false;
    }

    showPagesIndex();
    if (addToHistory) pushPagesHistory('directory', normalizedDir);
    else updatePagesHistoryButtons();
    return true;
  }

  function scrollPagesToAnchor(anchor) {
    if (!anchor) {
      pagesContentWrap.scrollTop = 0;
      return;
    }

    const decoded = decodeURIComponent(anchor);
    const escaped =
      window.CSS && typeof window.CSS.escape === 'function'
        ? window.CSS.escape(decoded)
        : decoded.replace(/"/g, '\\"');
    const target =
      pagesBody.querySelector(`#${escaped}`) ||
      pagesBody.querySelector(`[name="${decoded.replace(/"/g, '\\"')}"]`);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start' });
    } else {
      pagesContentWrap.scrollTop = 0;
    }
  }

  async function pagesOpenFile(remotePath, addToHistory = true, options = {}) {
    const normalizedPath = normalizeWebdavPath(remotePath);
    if (!isPathWithinPagesRoot(normalizedPath)) {
      if (!options.suppressError) {
        showToast('That page is outside the selected WebDAV root', 'error');
      }
      return false;
    }
    if (!isWebdavPagesFilePath(normalizedPath)) {
      if (!options.suppressError) {
        showToast('That file type is not supported in Pages', 'error');
      }
      return false;
    }

    const previousViewState = capturePagesViewState();
    showPagesLoadingState();
    const dirPath = getWebdavDirname(normalizedPath);
    const listed = await ensurePagesDirectoryState(dirPath, { suppressError: options.suppressError });
    if (!listed) {
      restorePagesViewState(previousViewState);
      return false;
    }

    let result;
    try {
      result = await withTimeout(
        window.electronAPI.webdavReadFile({ remotePath: normalizedPath }),
        REMOTE_REQUEST_TIMEOUT_MS,
        'Timed out loading this WebDAV page.'
      );
    } catch (err) {
      restorePagesViewState(previousViewState);
      if (!options.suppressError) {
        showToast(err.message || 'Failed to load page', 'error');
      }
      return false;
    }
    if (!result.success) {
      restorePagesViewState(previousViewState);
      if (!options.suppressError) {
        showToast(result.error || 'Failed to load page', 'error');
      }
      return false;
    }

    try {
      await withTimeout(
        renderPagesFileContent(result, normalizedPath),
        PAGES_RENDER_TIMEOUT_MS,
        'Timed out rendering this page.'
      );
    } catch (err) {
      restorePagesViewState(previousViewState);
      if (!options.suppressError) {
        showToast(err.message || 'Failed to render page', 'error');
      }
      return false;
    }
    pagesInterceptLinks();
    pagesLoading.classList.add('hidden');
    pagesEmptyState.classList.add('hidden');
    pagesIndexView.classList.add('hidden');
    pagesContentWrap.classList.remove('hidden');

    _pagesCurrentDir = dirPath;
    _pagesCurrentFilePath = normalizedPath;
    pagesCurrentPath = normalizedPath;
    _pagesInitialized = true;
    updatePagesLocationUi();
    updatePagesSidebarActiveItem();
    if (addToHistory) pushPagesHistory('file', normalizedPath);
    else updatePagesHistoryButtons();
    scrollPagesToAnchor(options.anchor || '');
    return true;
  }

  function resolvePagesLink(href) {
    const baseDir = ensureWebdavDirectoryPath(_pagesCurrentDir || _pagesWebdavRoot);
    const base = `https://pages.local${baseDir === '/' ? '/' : `${baseDir}/`}`;
    const url = new URL(href, base);
    return {
      path: decodeURIComponent(url.pathname || '/'),
      hash: decodeURIComponent(url.hash.replace(/^#/, '')),
      rawPath: href.split('#')[0].split('?')[0],
    };
  }

  function buildPagesLinkCandidates(pathname, rawPath) {
    const normalizedPath = normalizeWebdavPath(pathname);
    const candidates = [];
    const addCandidate = (type, path) => {
      const normalized =
        type === 'directory' ? ensureWebdavDirectoryPath(path) : normalizeWebdavPath(path);
      if (!candidates.some((entry) => entry.type === type && entry.path === normalized)) {
        candidates.push({ type, path: normalized });
      }
    };

    if (isWebdavPagesFilePath(normalizedPath)) {
      addCandidate('file', normalizedPath);
      return candidates;
    }

    if ((rawPath || '').endsWith('/')) {
      PAGES_SUPPORTED_EXTENSIONS.forEach((ext) => {
        addCandidate('file', `${normalizedPath === '/' ? '' : normalizedPath}/index${ext}`);
      });
      addCandidate('directory', normalizedPath);
      return candidates;
    }

    PAGES_SUPPORTED_EXTENSIONS.forEach((ext) => addCandidate('file', `${normalizedPath}${ext}`));
    PAGES_SUPPORTED_EXTENSIONS.forEach((ext) => {
      addCandidate('file', `${normalizedPath === '/' ? '' : normalizedPath}/index${ext}`);
    });
    addCandidate('directory', normalizedPath);
    return candidates;
  }

  async function pagesNavigateFromHref(href) {
    const { path, hash, rawPath } = resolvePagesLink(href);
    const candidates = buildPagesLinkCandidates(path, rawPath);
    for (const candidate of candidates) {
      const ok = await pagesNavigate(candidate.path, true, {
        type: candidate.type,
        suppressError: true,
        anchor: hash,
      });
      if (ok) return;
    }
    showToast(`Could not open ${href}`, 'error');
  }

  function pagesInterceptLinks() {
    pagesBody.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || /^https?:/i.test(href) || href.startsWith('//') || href.startsWith('mailto:')) {
        return;
      }
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (href.startsWith('#')) {
          scrollPagesToAnchor(href.slice(1));
          return;
        }
        pagesNavigateFromHref(href);
      });
    });
  }

  async function pagesNavigate(targetPath, addToHistory = true, options = {}) {
    const type = options.type || (isWebdavPagesFilePath(targetPath) ? 'file' : 'directory');
    if (type === 'directory') return pagesLoadDirectory(targetPath, addToHistory, options);
    return pagesOpenFile(targetPath, addToHistory, options);
  }

  async function savePagesWebdavRoot(rootPath) {
    if (!window.electronAPI) return false;
    const settings = (await window.electronAPI.loadSettings()) || {};
    settings.webdav = {
      ...(settings.webdav || {}),
      pagesRoot: ensureWebdavDirectoryPath(rootPath),
    };
    await window.electronAPI.saveSettings(settings);
    setPagesWebdavRoot(settings.webdav.pagesRoot);
    return true;
  }

  async function pagesInit() {
    if (!window.electronAPI) return;

    _pagesInitialized = false;
    pagesHistory = [];
    pagesHistoryIdx = -1;
    pagesCurrentPath = null;
    _pagesFileList = [];
    _pagesCurrentFilePath = null;
    pagesSidebarSearch.value = '';
    pagesFileTree.innerHTML = '';
    updatePagesHistoryButtons();

    const settings = await window.electronAPI.loadSettings();
    setPagesWebdavRoot(settings?.webdav?.pagesRoot || '/');
    _pagesCurrentDir = _pagesWebdavRoot;
    updatePagesLocationUi();

    const ok = await pagesLoadDirectory(_pagesWebdavRoot, true, { suppressError: true });
    if (!ok) {
      const message = settings?.webdav?.url
        ? 'The selected WebDAV folder could not be loaded. Check the server URL, credentials, and folder permissions.'
        : 'Configure WebDAV in Settings to browse pages from a remote folder.';
      showPagesEmptyState('Unable to load WebDAV pages', message);
    }
  }

  function openPagesFolderPicker() {
    const initialPath = _pagesCurrentFilePath ? _pagesCurrentDir : _pagesCurrentDir || _pagesWebdavRoot;
    openOpenFromWebdavModal({
      mode: REMOTE_BROWSER_MODE_FOLDER,
      provider: REMOTE_PROVIDER_WEBDAV,
      initialPath,
    });
  }

  if (btnPagesChooseFolder) {
    btnPagesChooseFolder.addEventListener('click', openPagesFolderPicker);
  }

  btnPagesBack.addEventListener('click', async () => {
    if (pagesHistoryIdx <= 0) return;
    const previousIdx = pagesHistoryIdx;
    const nextIdx = pagesHistoryIdx - 1;
    pagesHistoryIdx = nextIdx;
    const entry = pagesHistory[nextIdx];
    const ok = await pagesNavigate(entry.path, false, { type: entry.type });
    if (!ok) pagesHistoryIdx = previousIdx;
    updatePagesHistoryButtons();
  });

  btnPagesForward.addEventListener('click', async () => {
    if (pagesHistoryIdx >= pagesHistory.length - 1) return;
    const previousIdx = pagesHistoryIdx;
    const nextIdx = pagesHistoryIdx + 1;
    pagesHistoryIdx = nextIdx;
    const entry = pagesHistory[nextIdx];
    const ok = await pagesNavigate(entry.path, false, { type: entry.type });
    if (!ok) pagesHistoryIdx = previousIdx;
    updatePagesHistoryButtons();
  });

  btnPagesRefresh.addEventListener('click', () => {
    if (_pagesCurrentFilePath) {
      pagesNavigate(_pagesCurrentFilePath, false, { type: 'file' });
      return;
    }
    pagesNavigate(_pagesCurrentDir || _pagesWebdavRoot, false, { type: 'directory' });
  });

  btnPagesSidebarToggle.addEventListener('click', () => {
    pagesSidebar.classList.toggle('collapsed');
  });

  pagesSidebarSearch.addEventListener('input', applyPagesSidebarFilter);

  // ── Shared tab bar rendering ──

  const emptyStateHtml = markdownBody.innerHTML;

  function basenameForPath(filePath) {
    return filePath ? filePath.split(/[/\\]/).pop() : '';
  }

  function stripFileExtension(name) {
    return name ? name.replace(/\.[^.]+$/, '') : '';
  }

  function ensureTextFilename(name, fallbackBase) {
    const trimmed = (name || '').trim();
    const base = trimmed || fallbackBase;
    return /\.[^.\/\\]+$/.test(base) ? base : `${base}.md`;
  }

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

  async function _readerRenderTab(tab, { preserveScroll = false } = {}) {
    const isLargePlaintext = tab.fileType === 'plaintext' && tab.fileSize >= RENDER_VIRTUAL_THRESHOLD;
    const canReuseRenderedHtml = tab.renderedHtml && tab.fileType !== 'pdf';

    if (tab.largeFile && tab.largeFile.virtualRenderer) {
      markdownBody.innerHTML = '';
      await tab.largeFile.virtualRenderer.attach();
      tab.largeFile.virtualRenderer.scrollTo(tab.scrollTop || 0);
    } else if (isLargePlaintext) {
      const vr = new VirtualTextRenderer(readerScrollContainer, markdownBody, tab.rawContent);
      tab.largeFile = { virtualRenderer: vr };
      await vr.attach();
      if (preserveScroll) vr.scrollTo(tab.scrollTop || 0);
    } else if (canReuseRenderedHtml) {
      markdownBody.innerHTML = tab.renderedHtml;
    } else if (tab.fileType === 'pdf') {
      await renderPdf(tab.rawContent);
    } else if (tab.fileType === 'plaintext') {
      renderPlainText(tab.rawContent);
      if (!tab.fileSize || tab.fileSize < RENDER_PROGRESSIVE_THRESHOLD) {
        tab.renderedHtml = markdownBody.innerHTML;
      }
    } else {
      await renderMarkdown(tab.rawContent);
      if (!tab.fileSize || tab.fileSize < RENDER_PROGRESSIVE_THRESHOLD) {
        tab.renderedHtml = markdownBody.innerHTML;
      }
    }

    if (preserveScroll && !isLargePlaintext && !(tab.largeFile && tab.largeFile.virtualRenderer)) {
      const max = readerScrollContainer.scrollHeight - readerScrollContainer.clientHeight;
      readerScrollContainer.scrollTop = Math.min(tab.scrollTop || 0, Math.max(0, max));
    }
  }

  async function readerActivateTab(tabId) {
    readerSaveScroll();

    // Detach current virtual scroller if switching away from it
    const prevTab = readerTabs.find((t) => t.id === activeReaderTabId);
    if (prevTab && prevTab.largeFile && prevTab.largeFile.virtualRenderer) {
      prevTab.largeFile.virtualRenderer.detach();
    }
    // Release previous PDF doc/observer. pdf.js keeps shared-memory canvas
    // buffers alive until destroy() is called; disconnecting the observer
    // alone leaks a /dev/shm fd per PDF viewed over a session.
    if (markdownBody._pdfObserver) {
      markdownBody._pdfObserver.disconnect();
      markdownBody._pdfObserver = null;
    }
    if (markdownBody._pdfDoc) {
      _cancelPdfRenderTasks(markdownBody._pdfDoc);
      try { markdownBody._pdfDoc.destroy(); } catch (_) {}
      markdownBody._pdfDoc = null;
    }

    const tab = readerTabs.find((t) => t.id === tabId);
    if (!tab) return;
    activeReaderTabId = tabId;

    await _readerRenderTab(tab, { preserveScroll: true });

    renderTabBar(readerTabBar, readerTabs, activeReaderTabId, readerActivateTab, readerCloseTab);
  }

  // Re-read the active Reader tab's remote file when the window regains focus.
  // WebDAV only. Stat-gated (etag/lastmod), single-flight, cooldown-throttled.
  // Large / virtual-rendered files are skipped to avoid jarring re-renders.
  const READER_REFRESH_COOLDOWN_MS = 2000;
  async function refreshActiveReaderTabIfRemote() {
    if (document.visibilityState !== 'visible') return;
    if (currentMode !== 'reader') return;
    if (activeReaderTabId == null) return;
    const tab = readerTabs.find((t) => t.id === activeReaderTabId);
    if (!tab || tab.source !== REMOTE_PROVIDER_WEBDAV || !tab.remotePath) return;
    if (tab.largeFile || (tab.fileSize && tab.fileSize >= RENDER_PROGRESSIVE_THRESHOLD)) return;
    if (tab._refreshInFlight) return;
    const now = Date.now();
    if (tab._lastRefreshAt && now - tab._lastRefreshAt < READER_REFRESH_COOLDOWN_MS) return;
    tab._refreshInFlight = true;
    tab._lastRefreshAt = now;

    const tabId = tab.id;
    const remotePath = tab.remotePath;

    try {
      const s = await window.electronAPI.webdavStat({ remotePath });
      if (!s?.success || !s.exists) return;
      const changed =
        (s.etag && s.etag !== tab.etag) ||
        (!s.etag && s.lastmod && s.lastmod !== tab.lastmod) ||
        (s.size != null && s.size !== tab.fileSize);
      if (!changed) return;

      const r = await window.electronAPI.webdavReadFile({ remotePath, skipTrack: true });
      if (!r?.success) return;

      const stillSameTab =
        tab.remotePath === remotePath && readerTabs.some((t) => t.id === tabId);
      if (!stillSameTab) return;

      if (r.content === tab.rawContent) {
        tab.etag = r.etag || s.etag || tab.etag;
        tab.lastmod = r.lastmod || s.lastmod || tab.lastmod;
        return;
      }

      tab.rawContent = r.content;
      tab.fileSize = s.size ?? tab.fileSize;
      tab.etag = r.etag || s.etag || null;
      tab.lastmod = r.lastmod || s.lastmod || null;
      tab.renderedHtml = null;

      const isActiveAndVisible =
        activeReaderTabId === tabId && currentMode === 'reader';
      if (!isActiveAndVisible) return;

      // Save current scroll in case user scrolled after initial activate.
      tab.scrollTop = readerScrollContainer.scrollTop;
      await _readerRenderTab(tab, { preserveScroll: true });
    } catch (e) {
      console.warn('[reader refresh] skipped:', e);
    } finally {
      tab._refreshInFlight = false;
    }
  }

  window.addEventListener('focus', refreshActiveReaderTabIfRemote);
  document.addEventListener('visibilitychange', refreshActiveReaderTabIfRemote);

  function readerCloseTab(tabId) {
    const idx = readerTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    // Clean up large file resources
    const tab = readerTabs[idx];
    if (tab.largeFile && tab.largeFile.virtualRenderer) {
      tab.largeFile.virtualRenderer.destroy();
    }
    if (markdownBody._pdfObserver && activeReaderTabId === tabId) {
      markdownBody._pdfObserver.disconnect();
      markdownBody._pdfObserver = null;
    }
    if (markdownBody._pdfDoc && activeReaderTabId === tabId) {
      _cancelPdfRenderTasks(markdownBody._pdfDoc);
      try { markdownBody._pdfDoc.destroy(); } catch (_) {}
      markdownBody._pdfDoc = null;
    }
    tab.rawContent = null;
    tab.renderedHtml = null;
    tab.largeFile = null;

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

  async function readerOpenFile(filePath, content, options = {}) {
    const source = options.source || 'local';
    const fileType = classifyFileType(filePath, options.fileType);
    const existing = readerTabs.find((t) => t.filePath === filePath && (t.source || 'local') === source);
    if (existing) {
      await readerActivateTab(existing.id);
      return;
    }

    const id = ++tabIdCounter;
    const fileName = options.fileName || basenameForPath(filePath);
    const tab = {
      id,
      filePath,
      fileName,
      rawContent: content,
      renderedHtml: null,
      scrollTop: 0,
      source,
      remotePath: options.remotePath || null,
      remoteKey: options.remoteKey || null,
      fileType,
      fileSize: options.fileSize || (content ? content.length : 0),
      largeFile: null,
      lastmod: options.lastmod || null,
      etag: options.etag || null,
    };
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

  function mdEditorNewTab(filePath, content, options = {}) {
    const source = options.source || 'local';
    if (filePath) {
      const existing = mdEditorTabs.find(
        (t) => t.filePath === filePath && (t.source || 'local') === source
      );
      if (existing) {
        mdEditorActivateTab(existing.id);
        return;
      }
    }

    mdEditorSaveCurrentTab();
    const id = ++tabIdCounter;
    const fileName = options.fileName || (filePath ? basenameForPath(filePath) : 'untitled.md');
    const tab = {
      id,
      filePath: filePath || null,
      fileName,
      content: content || '',
      scrollTop: 0,
      renderedHtml: null,
      source,
      remotePath: options.remotePath || null,
      remoteKey: options.remoteKey || null,
    };
    mdEditorTabs.push(tab);
    mdEditorActivateTab(id);
  }

  btnEditorNew.addEventListener('click', () => {
    if (isEditorSubMode('md-editor')) {
      mdEditorNewTab(null, '');
    } else if (isEditorSubMode('mermaid')) {
      editor.setValue('graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E');
      document.getElementById('filename-input').value = '';
    } else if (isEditorSubMode('latex')) {
      latexEditor.setValue('E = mc^2');
      document.getElementById('latex-filename-input').value = '';
    }
  });

  function localBrowserAllowsMultiSelect() {
    return !isEditorSubMode('mermaid') && !isEditorSubMode('latex');
  }

  async function applyOpenedFileResult(result, options = {}) {
    const source = options.source || 'local';
    const remotePath = options.remotePath || null;
    const remoteKey = options.remoteKey || null;
    const fileName = options.fileName || result.fileName || basenameForPath(result.filePath);

    // Handle large file gating from main process
    if (result.tooLarge) {
      showToast(fileName + ' is too large to open (' + formatFileSize(result.fileSize) + ', max 200 MB)', 'error');
      return;
    }
    if (result.needsConfirmation) {
      const confirmed = await showLargeFileWarning(fileName, result.fileSize);
      if (!confirmed) return;
      if (window.electronAPI && window.electronAPI.readFileConfirmed) {
        showToast('Reading ' + fileName + '...', 'info');
        const loaded = await window.electronAPI.readFileConfirmed(result.filePath);
        if (!loaded) return;
        result = { ...result, ...loaded, fileSize: result.fileSize };
      } else {
        return;
      }
    }

    if (currentMode === 'reader') {
      await readerOpenFile(result.filePath, result.content, {
        source,
        fileName,
        remotePath,
        remoteKey,
        fileType: options.fileType || result.fileType,
        fileSize: result.fileSize,
        lastmod: result.lastmod || null,
        etag: result.etag || null,
      });
      return;
    }

    if (isEditorSubMode('md-editor')) {
      mdEditorNewTab(result.filePath, result.content, {
        source,
        fileName,
        remotePath,
        remoteKey,
      });
      return;
    }

    if (isEditorSubMode('mermaid')) {
      editor.setValue(result.content);
      filenameInput.value = stripFileExtension(fileName) || 'mermaid-diagram';
      _mermaidLocalPath = source === 'local' ? result.filePath : null;
      _mermaidRemoteRef =
        source === REMOTE_PROVIDER_WEBDAV
          ? { provider: source, remotePath, fileName }
          : source === REMOTE_PROVIDER_CLOUD
            ? { provider: source, remoteKey, fileName }
            : null;
      await renderDiagram();
      return;
    }

    if (isEditorSubMode('latex')) {
      latexEditor.setValue(result.content);
      latexFilenameInput.value = stripFileExtension(fileName) || 'latex-equation';
      _latexLocalPath = source === 'local' ? result.filePath : null;
      _latexRemoteRef =
        source === REMOTE_PROVIDER_WEBDAV
          ? { provider: source, remotePath, fileName }
          : source === REMOTE_PROVIDER_CLOUD
            ? { provider: source, remoteKey, fileName }
            : null;
      await renderLatex();
      return;
    }

    if (!isEditorSubMode('md-editor')) {
      switchMode('editor');
      switchEditorSubMode('md-editor');
    }
    mdEditorNewTab(result.filePath, result.content, {
      source,
      fileName,
      remotePath,
      remoteKey,
    });
  }

  async function openLocalFiles() {
    if (!window.electronAPI) return;
    const results = await window.electronAPI.openFile({
      allowMultiple: localBrowserAllowsMultiSelect(),
    });
    if (!results || results.length === 0) return;

    for (const result of results) {
      await applyOpenedFileResult(result, { source: 'local' });
      if (!localBrowserAllowsMultiSelect()) break;
    }
  }

  function remoteBrowserAllowsMultiSelect() {
    return currentMode === 'reader' || isEditorSubMode('md-editor');
  }

  function getRemoteProviderLabel(provider) {
    return provider === REMOTE_PROVIDER_CLOUD ? 'Public Cloud Service' : 'WebDAV';
  }

  function getDefaultSaveName(tab, ext) {
    if (tab) {
      const name = tab.fileName || (tab.filePath && basenameForPath(tab.filePath));
      if (name && !/^untitled/i.test(name)) {
        return name.replace(/\.[^.]+$/, '') + '.' + ext;
      }
    }
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${date}-untitled.${ext}`;
  }

  function isLocalFileSource(source) {
    return !source || source === 'local';
  }

  function applyLocalSaveToTab(tab, savedPath, renderTabs) {
    if (!tab) return;
    tab.filePath = savedPath;
    tab.fileName = basenameForPath(savedPath);
    tab.source = 'local';
    tab.remotePath = null;
    tab.remoteKey = null;
    renderTabs();
  }

  function applyRemoteSaveToTab(tab, provider, identifier, renderTabs) {
    if (!tab) return;
    if (provider === REMOTE_PROVIDER_WEBDAV) {
      tab.filePath = identifier;
      tab.fileName = basenameForPath(identifier);
      tab.source = REMOTE_PROVIDER_WEBDAV;
      tab.remotePath = identifier;
      tab.remoteKey = null;
    } else {
      tab.filePath = `cloud://${identifier}`;
      tab.fileName = basenameForPath(identifier) || identifier;
      tab.source = REMOTE_PROVIDER_CLOUD;
      tab.remotePath = null;
      tab.remoteKey = identifier;
    }
    renderTabs();
  }

  function getCurrentLocalSaveState() {
    if (currentMode === 'reader') return null;

    if (isEditorSubMode('md-editor')) {
      const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
      if (!tab) {
        showToast('No file open to save', 'error');
        return null;
      }
      return {
        content: mdEditor.getValue(),
        defaultPath:
          isLocalFileSource(tab.source) && tab.filePath
            ? tab.filePath
            : ensureTextFilename(tab.fileName || getDefaultSaveName(tab, 'md'), 'untitled'),
        onSaved(savedPath) {
          applyLocalSaveToTab(tab, savedPath, () =>
            renderTabBar(
              mdEditorTabBar,
              mdEditorTabs,
              activeMdEditorTabId,
              mdEditorActivateTab,
              mdEditorCloseTab
            )
          );
        },
      };
    }

    if (isEditorSubMode('mermaid')) {
      return {
        content: editor.getValue(),
        defaultPath: _mermaidLocalPath || ensureTextFilename(filenameInput.value, 'mermaid-diagram'),
        onSaved(savedPath) {
          _mermaidLocalPath = savedPath;
          _mermaidRemoteRef = null;
          filenameInput.value = stripFileExtension(basenameForPath(savedPath));
        },
      };
    }

    if (isEditorSubMode('latex')) {
      return {
        content: latexEditor.getValue(),
        defaultPath: _latexLocalPath || ensureTextFilename(latexFilenameInput.value, 'latex-equation'),
        onSaved(savedPath) {
          _latexLocalPath = savedPath;
          _latexRemoteRef = null;
          latexFilenameInput.value = stripFileExtension(basenameForPath(savedPath));
        },
      };
    }

    showToast('Switch to Editor mode to save', 'error');
    return null;
  }

  async function saveCurrentToLocal() {
    if (!window.electronAPI) return;
    const state = getCurrentLocalSaveState();
    if (!state) return;

    const savedPath = await window.electronAPI.saveFile({
      defaultPath: state.defaultPath,
      content: state.content,
    });
    if (!savedPath) return;

    state.onSaved(savedPath);
    showToast(`Saved file: ${basenameForPath(savedPath)}`, 'success');
  }

  function getCurrentRemoteSaveState() {
    if (currentMode === 'reader') return null;

    if (isEditorSubMode('md-editor')) {
      const tab = mdEditorTabs.find((t) => t.id === activeMdEditorTabId);
      if (!tab) {
        showToast('No file open to save', 'error');
        return null;
      }
      return {
        content: mdEditor.getValue(),
        fileName: ensureTextFilename(tab.fileName || getDefaultSaveName(tab, 'md'), 'untitled'),
        remotePath: tab.remotePath,
        remoteKey: tab.remoteKey,
        onSaved(provider, identifier) {
          applyRemoteSaveToTab(tab, provider, identifier, () =>
            renderTabBar(
              mdEditorTabBar,
              mdEditorTabs,
              activeMdEditorTabId,
              mdEditorActivateTab,
              mdEditorCloseTab
            )
          );
        },
      };
    }

    if (isEditorSubMode('mermaid')) {
      return {
        content: editor.getValue(),
        fileName: ensureTextFilename(filenameInput.value, 'mermaid-diagram'),
        remotePath:
          _mermaidRemoteRef?.provider === REMOTE_PROVIDER_WEBDAV ? _mermaidRemoteRef.remotePath : null,
        remoteKey:
          _mermaidRemoteRef?.provider === REMOTE_PROVIDER_CLOUD ? _mermaidRemoteRef.remoteKey : null,
        onSaved(provider, identifier) {
          _mermaidLocalPath = null;
          if (provider === REMOTE_PROVIDER_WEBDAV) {
            _mermaidRemoteRef = {
              provider,
              remotePath: identifier,
              fileName: basenameForPath(identifier),
            };
            filenameInput.value = stripFileExtension(basenameForPath(identifier));
          } else {
            const label = basenameForPath(identifier) || identifier;
            _mermaidRemoteRef = { provider, remoteKey: identifier, fileName: label };
            filenameInput.value = stripFileExtension(label);
          }
        },
      };
    }

    if (isEditorSubMode('latex')) {
      return {
        content: latexEditor.getValue(),
        fileName: ensureTextFilename(latexFilenameInput.value, 'latex-equation'),
        remotePath:
          _latexRemoteRef?.provider === REMOTE_PROVIDER_WEBDAV ? _latexRemoteRef.remotePath : null,
        remoteKey:
          _latexRemoteRef?.provider === REMOTE_PROVIDER_CLOUD ? _latexRemoteRef.remoteKey : null,
        onSaved(provider, identifier) {
          _latexLocalPath = null;
          if (provider === REMOTE_PROVIDER_WEBDAV) {
            _latexRemoteRef = {
              provider,
              remotePath: identifier,
              fileName: basenameForPath(identifier),
            };
            latexFilenameInput.value = stripFileExtension(basenameForPath(identifier));
          } else {
            const label = basenameForPath(identifier) || identifier;
            _latexRemoteRef = { provider, remoteKey: identifier, fileName: label };
            latexFilenameInput.value = stripFileExtension(label);
          }
        },
      };
    }

    showToast('Switch to Editor mode to save', 'error');
    return null;
  }

  async function saveCurrentToRemote() {
    if (!window.electronAPI) return;
    const state = getCurrentRemoteSaveState();
    if (!state) return;

    const provider = _remoteProvider;
    if (provider === REMOTE_PROVIDER_WEBDAV) {
      if (state.remotePath) {
        showToast('Saving to WebDAV…', 'info');
        const result = await window.electronAPI.webdavWriteFile({
          remotePath: state.remotePath,
          content: state.content,
        });
        if (!result.success) {
          showToast(result.error || 'Failed to save to WebDAV', 'error');
          return;
        }
        state.onSaved(provider, state.remotePath);
        showToast(`Saved to WebDAV: ${basenameForPath(state.remotePath)}`, 'success');
      } else {
        _pendingSaveState = state;
        await openOpenFromWebdavModal({
          mode: REMOTE_BROWSER_MODE_SAVE,
          provider: REMOTE_PROVIDER_WEBDAV,
        });
        return;
      }
    } else {
      const key = state.remoteKey || state.fileName;
      showToast('Saving to public cloud…', 'info');
      const result = await window.electronAPI.cloudBackupFile({ key, content: state.content });
      if (!result.success) {
        showToast(result.error || 'Failed to save to public cloud', 'error');
        return;
      }
      state.onSaved(provider, key);
      showToast(`Saved to public cloud: ${basenameForPath(key) || key}`, 'success');
    }

    _pagesInitialized = false;
    if (currentMode === 'pages') pagesInit();
  }

  let _webdavCurrentPath = '/';

  function isRemoteBrowserFolderMode() {
    return _remoteBrowserMode === REMOTE_BROWSER_MODE_FOLDER;
  }

  function isRemoteBrowserSaveMode() {
    return _remoteBrowserMode === REMOTE_BROWSER_MODE_SAVE;
  }

  function isRemoteBrowserPickerMode() {
    return isRemoteBrowserFolderMode() || isRemoteBrowserSaveMode();
  }

  function updateRemoteBrowserUi() {
    const saveMode = isRemoteBrowserSaveMode();
    const folderMode = isRemoteBrowserFolderMode();
    if (openFromWebdavTitle) {
      openFromWebdavTitle.textContent = saveMode
        ? 'Save to WebDAV'
        : folderMode
          ? 'Choose WebDAV Folder'
          : 'Open Remote';
    }
    openFromWebdavLoading.textContent =
      (saveMode || folderMode) ? 'Loading folders…' : 'Loading remote files…';
    btnOpenFromWebdavOpen.textContent = saveMode
      ? 'Save Here'
      : folderMode
        ? 'Use This Folder'
        : 'Open';
  }

  function closeOpenFromWebdavModal() {
    openFromWebdavModal.classList.add('hidden');
    openFromWebdavList.innerHTML = '';
    openFromWebdavError.classList.add('hidden');
    openFromWebdavError.textContent = '';
    webdavBreadcrumb.innerHTML = '';
    webdavBreadcrumb.classList.add('hidden');
    _remoteBrowserSelectedFiles = [];
    _pendingSaveState = null;
    if (webdavSaveFilename) {
      webdavSaveFilename.classList.add('hidden');
      webdavSaveFilename.textContent = '';
    }
    _remoteBrowserMode = REMOTE_BROWSER_MODE_OPEN;
    btnOpenFromWebdavOpen.disabled = true;
    updateRemoteBrowserUi();
  }

  function buildWebdavBreadcrumb(dirPath) {
    webdavBreadcrumb.innerHTML = '';
    const segments = dirPath.split('/').filter(Boolean);
    const root = document.createElement('span');
    root.textContent = '/';
    root.addEventListener('click', () => loadWebdavDirectory('/'));
    webdavBreadcrumb.appendChild(root);
    segments.forEach((seg, i) => {
      const full = '/' + segments.slice(0, i + 1).join('/');
      const span = document.createElement('span');
      span.textContent = seg;
      span.addEventListener('click', () => loadWebdavDirectory(full));
      webdavBreadcrumb.appendChild(span);
    });
  }

  function updateRemoteSelection(identifier, checked) {
    if (checked) {
      if (!remoteBrowserAllowsMultiSelect()) {
        _remoteBrowserSelectedFiles = [identifier];
        openFromWebdavList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          if (input.dataset.identifier !== identifier) input.checked = false;
        });
      } else if (!_remoteBrowserSelectedFiles.includes(identifier)) {
        _remoteBrowserSelectedFiles.push(identifier);
      }
    } else {
      _remoteBrowserSelectedFiles = _remoteBrowserSelectedFiles.filter((value) => value !== identifier);
    }
    if (!isRemoteBrowserPickerMode()) {
      btnOpenFromWebdavOpen.disabled = _remoteBrowserSelectedFiles.length === 0;
    }
  }

  function makeRemoteFileRow(identifier, label, iconText, options = {}) {
    const selectable = options.selectable !== false;
    const row = document.createElement('div');
    row.className = 'webdav-browser-item' + (selectable ? '' : ' webdav-browser-item-disabled');
    let cb = null;
    if (selectable) {
      cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.identifier = identifier;
      cb.style.marginRight = '8px';
      cb.addEventListener('change', () => updateRemoteSelection(identifier, cb.checked));
      row.appendChild(cb);
    }

    const icon = document.createElement('span');
    icon.className = 'webdav-icon';
    icon.textContent = iconText;
    row.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = label;
    row.appendChild(name);

    if (selectable) {
      row.addEventListener('click', (e) => {
        if (e.target === cb) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });
    }

    return row;
  }

  async function loadWebdavDirectory(dirPath) {
    if (!window.electronAPI) return;
    const normalizedDir = ensureWebdavDirectoryPath(dirPath);
    const pickerMode = isRemoteBrowserPickerMode();
    _remoteBrowserSelectedFiles = [];
    _webdavCurrentPath = normalizedDir;
    btnOpenFromWebdavOpen.disabled = true;
    buildWebdavBreadcrumb(normalizedDir);
    webdavBreadcrumb.classList.remove('hidden');

    openFromWebdavError.classList.add('hidden');
    openFromWebdavLoading.classList.remove('hidden');
    openFromWebdavList.innerHTML = '';

    let result;
    try {
      result = await withTimeout(
        window.electronAPI.webdavListFiles({ path: normalizedDir }),
        REMOTE_REQUEST_TIMEOUT_MS,
        'Timed out loading this WebDAV folder.'
      );
    } catch (err) {
      openFromWebdavLoading.classList.add('hidden');
      openFromWebdavError.textContent = err.message || 'Failed to load directory.';
      openFromWebdavError.classList.remove('hidden');
      btnOpenFromWebdavOpen.disabled = true;
      return;
    }
    openFromWebdavLoading.classList.add('hidden');

    if (!result.success) {
      openFromWebdavError.textContent = result.error || 'Failed to load directory.';
      openFromWebdavError.classList.remove('hidden');
      btnOpenFromWebdavOpen.disabled = true;
      return;
    }

    if ((result.items || []).length === 0) {
      openFromWebdavError.textContent = isRemoteBrowserSaveMode()
        ? 'This folder is empty. You can still save here.'
        : isRemoteBrowserFolderMode()
          ? 'This folder is empty. You can still use it as the Pages root.'
          : 'No files found in this directory.';
      openFromWebdavError.classList.remove('hidden');
      btnOpenFromWebdavOpen.disabled = !pickerMode;
      return;
    }

    result.items.forEach((item) => {
      if (item.type === 'directory') {
        const row = document.createElement('div');
        row.className = 'webdav-browser-item';
        row.innerHTML = `<span class="webdav-icon">&#128193;</span><span>${item.name}</span>`;
        row.addEventListener('click', () => loadWebdavDirectory(item.path));
        openFromWebdavList.appendChild(row);
      } else {
        openFromWebdavList.appendChild(
          makeRemoteFileRow(item.path, item.name, '\uD83D\uDCC4', { selectable: !pickerMode })
        );
      }
    });
    btnOpenFromWebdavOpen.disabled = !pickerMode;
  }

  async function loadCloudFiles() {
    if (!window.electronAPI) return;
    _remoteBrowserSelectedFiles = [];
    btnOpenFromWebdavOpen.disabled = true;
    webdavBreadcrumb.innerHTML = '';
    webdavBreadcrumb.classList.add('hidden');

    openFromWebdavError.classList.add('hidden');
    openFromWebdavLoading.classList.remove('hidden');
    openFromWebdavList.innerHTML = '';

    const result = await window.electronAPI.cloudListFiles();
    openFromWebdavLoading.classList.add('hidden');

    if (!result.success) {
      openFromWebdavError.textContent = result.error || 'Failed to load remote files.';
      openFromWebdavError.classList.remove('hidden');
      return;
    }

    const files = result.files || [];
    if (files.length === 0) {
      openFromWebdavError.textContent = 'No files found in public cloud storage.';
      openFromWebdavError.classList.remove('hidden');
      return;
    }

    files.forEach((file) => {
      const title = file.title || file.key;
      const date = file.file_date ? ` (${file.file_date})` : '';
      openFromWebdavList.appendChild(makeRemoteFileRow(file.key, `${title}${date}`, '\u2601'));
    });
  }

  async function openOpenFromWebdavModal(options = {}) {
    if (!window.electronAPI) return;
    _remoteBrowserMode =
      options.mode === REMOTE_BROWSER_MODE_FOLDER
        ? REMOTE_BROWSER_MODE_FOLDER
        : options.mode === REMOTE_BROWSER_MODE_SAVE
          ? REMOTE_BROWSER_MODE_SAVE
          : REMOTE_BROWSER_MODE_OPEN;
    _remoteBrowserProvider =
      options.provider ||
      (isRemoteBrowserPickerMode() ? REMOTE_PROVIDER_WEBDAV : _remoteProvider);
    updateRemoteBrowserUi();
    if (isRemoteBrowserSaveMode() && webdavSaveFilename && _pendingSaveState) {
      webdavSaveFilename.textContent = `Saving: ${_pendingSaveState.fileName}`;
      webdavSaveFilename.classList.remove('hidden');
    } else if (webdavSaveFilename) {
      webdavSaveFilename.classList.add('hidden');
    }
    openFromWebdavModal.classList.remove('hidden');
    if (_remoteBrowserProvider === REMOTE_PROVIDER_WEBDAV) {
      const initialPath =
        _remoteBrowserMode === REMOTE_BROWSER_MODE_FOLDER
          ? ensureWebdavDirectoryPath(options.initialPath || _pagesWebdavRoot || '/')
          : ensureWebdavDirectoryPath(options.initialPath || '/');
      await loadWebdavDirectory(initialPath);
    } else {
      await loadCloudFiles();
    }
  }

  async function applyOpenedRemoteResult(result, provider) {
    const remotePath = provider === REMOTE_PROVIDER_WEBDAV ? result.filePath : null;
    const remoteKey =
      provider === REMOTE_PROVIDER_CLOUD
        ? (result.filePath || '').replace(/^cloud:\/\//, '') || result.fileName
        : null;
    const fileName =
      provider === REMOTE_PROVIDER_CLOUD
        ? basenameForPath(remoteKey) || remoteKey
        : result.fileName || basenameForPath(result.filePath);

    await applyOpenedFileResult(result, {
      source: provider,
      fileName,
      remotePath,
      remoteKey,
    });
  }

  btnOpenFromWebdavClose.addEventListener('click', closeOpenFromWebdavModal);
  btnOpenFromWebdavCancel.addEventListener('click', closeOpenFromWebdavModal);

  openFromWebdavModal.addEventListener('click', (e) => {
    if (e.target === openFromWebdavModal) closeOpenFromWebdavModal();
  });

  function handleOpenRemoteCommand() {
    if (currentMode === 'pages') {
      openPagesFolderPicker();
      return;
    }
    openOpenFromWebdavModal();
  }

  if (btnOpenFile) btnOpenFile.addEventListener('click', openLocalFiles);
  if (btnOpenFileEditor) btnOpenFileEditor.addEventListener('click', openLocalFiles);
  if (btnOpenRemoteReader) btnOpenRemoteReader.addEventListener('click', openOpenFromWebdavModal);
  if (btnOpenFromWebdavEditor)
    btnOpenFromWebdavEditor.addEventListener('click', openOpenFromWebdavModal);

  btnOpenFromWebdavOpen.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    if (isRemoteBrowserFolderMode()) {
      const selectedDir = ensureWebdavDirectoryPath(_webdavCurrentPath || _pagesWebdavRoot || '/');
      const saved = await savePagesWebdavRoot(selectedDir);
      if (!saved) return;
      closeOpenFromWebdavModal();
      showToast(
        `Pages root set to ${selectedDir === '/' ? 'File Space' : selectedDir}`,
        'success'
      );
      _pagesInitialized = false;
      if (currentMode === 'pages') await pagesInit();
      return;
    }

    if (isRemoteBrowserSaveMode()) {
      if (!_pendingSaveState) {
        closeOpenFromWebdavModal();
        return;
      }
      const folderPath = ensureWebdavDirectoryPath(_webdavCurrentPath || '/');
      const remotePath = normalizeWebdavPath(folderPath + '/' + _pendingSaveState.fileName);
      const state = _pendingSaveState;
      closeOpenFromWebdavModal();

      showToast('Saving to WebDAV…', 'info');
      const result = await window.electronAPI.webdavWriteFile({
        remotePath,
        content: state.content,
      });
      if (!result.success) {
        showToast(result.error || 'Failed to save to WebDAV', 'error');
        return;
      }
      state.onSaved(REMOTE_PROVIDER_WEBDAV, remotePath);
      showToast(`Saved to WebDAV: ${basenameForPath(remotePath)}`, 'success');

      _pagesInitialized = false;
      if (currentMode === 'pages') pagesInit();
      return;
    }

    const toOpen = [..._remoteBrowserSelectedFiles];
    if (toOpen.length === 0) return;

    let openedCount = 0;
    for (const identifier of toOpen) {
      const result =
        _remoteBrowserProvider === REMOTE_PROVIDER_WEBDAV
          ? await window.electronAPI.webdavReadFile({ remotePath: identifier })
          : await window.electronAPI.cloudRestoreFile({ key: identifier });

      if (!result.success) {
        showToast(result.error || `Failed to open ${identifier}`, 'error');
        continue;
      }

      await applyOpenedRemoteResult(result, _remoteBrowserProvider);
      openedCount += 1;

      if (!remoteBrowserAllowsMultiSelect()) break;
    }

    if (openedCount > 0) {
      closeOpenFromWebdavModal();
      showToast(
        `Opened ${openedCount} file(s) from ${getRemoteProviderLabel(_remoteBrowserProvider)}`,
        'success'
      );
    }
  });

  if (window.electronAPI && window.electronAPI.onFileOpened) {
    window.electronAPI.onFileOpened(async (data) => {
      await applyOpenedFileResult(data, {
        source: 'local',
        fileName: data.fileName || basenameForPath(data.filePath),
        fileType: data.fileType,
      });
    });
  }

  if (window.electronAPI && window.electronAPI.onMenuOpenFile) {
    window.electronAPI.onMenuOpenFile(() => openLocalFiles());
  }

  if (window.electronAPI && window.electronAPI.onMenuOpenRemote) {
    window.electronAPI.onMenuOpenRemote(() => handleOpenRemoteCommand());
  }

  if (window.electronAPI && window.electronAPI.onMenuSaveFile) {
    window.electronAPI.onMenuSaveFile(() => saveCurrentToLocal());
  }

  if (window.electronAPI && window.electronAPI.onMenuSaveRemote) {
    window.electronAPI.onMenuSaveRemote(() => saveCurrentToRemote());
  }

  if (btnSaveFileEditor) btnSaveFileEditor.addEventListener('click', saveCurrentToLocal);
  if (btnSaveRemoteEditor) btnSaveRemoteEditor.addEventListener('click', saveCurrentToRemote);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      openLocalFiles();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentToLocal();
    }
  });

  // ── Initialize default Markdown Editor tab ──

  mdEditorNewTab(null, mdEditor.getValue());

  // ════════════════════════════════════════════
  //  Settings Modal
  // ════════════════════════════════════════════

  // ── Settings panel switching (sidebar-driven) ──

  const settingsSidebarEl = document.querySelector('.settings-sidebar');
  const settingsPanelsNodeList = () => document.querySelectorAll('.settings-panel');

  function switchSettingsPanel(target) {
    settingsPanelsNodeList().forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.settingsPanel !== target);
    });
    document.querySelectorAll('.settings-nav-item').forEach((item) => {
      const t = item.dataset.settingsTarget;
      if (!t) {
        item.classList.remove('active');
        return;
      }
      if (t === 'agents') {
        const agentId = item.dataset.agentId || '__global__';
        item.classList.toggle(
          'active',
          target === 'agents' && agentId === _settingsAgents.selectedId
        );
      } else {
        item.classList.toggle('active', t === target);
      }
    });
  }

  // Back-compat alias — keeps legacy call sites working while we refactor.
  function switchSettingsTab(tab) {
    if (tab === 'general') switchSettingsPanel('remote-storage');
    else if (tab === 'agents') switchSettingsPanel('agents');
    else if (tab === 'rss') switchSettingsPanel('rss-feeds');
    else switchSettingsPanel(tab);
  }

  if (settingsSidebarEl) {
    settingsSidebarEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-nav-item');
      if (!btn) return;
      const target = btn.dataset.settingsTarget;
      if (!target) return;
      if (target === 'agents') {
        const agentId = btn.dataset.agentId || '__global__';
        selectAgentSettingsRail(agentId);
        switchSettingsPanel('agents');
      } else {
        switchSettingsPanel(target);
      }
    });
  }

  function getPreferredRemoteProvider(settings) {
    const saved = settings?.general?.remoteProvider;
    if (saved === REMOTE_PROVIDER_WEBDAV || saved === REMOTE_PROVIDER_CLOUD) {
      return saved;
    }
    if (settings?.cloud?.apiBaseUrl && !settings?.webdav?.url) {
      return REMOTE_PROVIDER_CLOUD;
    }
    return REMOTE_PROVIDER_WEBDAV;
  }

  function setRemoteProvider(provider) {
    _remoteProvider = provider === REMOTE_PROVIDER_CLOUD ? REMOTE_PROVIDER_CLOUD : REMOTE_PROVIDER_WEBDAV;
    if (generalRemoteProviderEl) generalRemoteProviderEl.value = _remoteProvider;
    if (generalRemoteWebdavEl) {
      generalRemoteWebdavEl.classList.toggle('hidden', _remoteProvider !== REMOTE_PROVIDER_WEBDAV);
    }
    if (generalRemoteCloudEl) {
      generalRemoteCloudEl.classList.toggle('hidden', _remoteProvider !== REMOTE_PROVIDER_CLOUD);
    }
  }

  function getLLMSettingsFromForm() {
    return {
      provider: llmProvider.value,
      baseUrl: llmBaseUrl.value.trim(),
      apiKey: llmApiKey.value,
      model: llmModel.value.trim(),
      temperature: parseFloat(llmTemperature.value),
      maxTokens: parseInt(llmMaxTokens.value, 10) || 128000,
      topP: parseFloat(llmTopP.value),
    };
  }

  // ── Agents settings tab state ──
  // The Settings → Agents tab has a left rail: "Global Defaults" + one row per
  // registered agent. The single LLM form below edits whichever row is selected.
  // Per-agent rows store *overrides* over the global LLM: blank text fields
  // inherit; numerics inherit only when identical to global at save time.
  const _settingsAgents = {
    selectedId: '__global__',
    globalLlm: null, // last-seen snapshot of global form values
    agentLlm: {},    // agentId → partial override object
  };
  const LLM_GLOBAL_PLACEHOLDERS = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-… (leave empty for local)',
    model: 'Type a model or fetch available models',
  };

  function _setSlider(el, valEl, v) {
    const n = Number(v);
    el.value = n;
    if (valEl) valEl.textContent = n.toFixed(2);
  }

  function _snapshotCurrentLlmForm() {
    const id = _settingsAgents.selectedId;
    if (id === '__global__') {
      _settingsAgents.globalLlm = getLLMSettingsFromForm();
      return;
    }
    const form = getLLMSettingsFromForm();
    const g = _settingsAgents.globalLlm || {};
    const override = {};
    // Text fields: blank = inherit.
    if (form.provider && form.provider !== g.provider) override.provider = form.provider;
    if (form.baseUrl && form.baseUrl !== g.baseUrl) override.baseUrl = form.baseUrl;
    if (form.apiKey && form.apiKey !== g.apiKey) override.apiKey = form.apiKey;
    if (form.model && form.model !== g.model) override.model = form.model;
    // Numerics: override only when user picked a value different from global.
    // Use epsilon compare — slider <input> round-trips floats through strings
    // and can produce e.g. 0.7 !== 0.7000000000000001 phantom overrides.
    const neq = (a, b) => !(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6);
    if (Number.isFinite(form.temperature) && neq(form.temperature, g.temperature)) {
      override.temperature = form.temperature;
    }
    if (Number.isFinite(form.maxTokens) && form.maxTokens !== g.maxTokens) {
      override.maxTokens = form.maxTokens;
    }
    if (Number.isFinite(form.topP) && neq(form.topP, g.topP)) {
      override.topP = form.topP;
    }
    _settingsAgents.agentLlm[id] = override;
  }

  function _loadLlmFormFromSelection() {
    const id = _settingsAgents.selectedId;
    const g = _settingsAgents.globalLlm || {};
    const isGlobal = id === '__global__';
    const o = isGlobal ? g : (_settingsAgents.agentLlm[id] || {});
    // Text fields
    if (isGlobal) {
      llmProvider.value = g.provider || 'openai';
      llmBaseUrl.value = g.baseUrl || '';
      llmApiKey.value = g.apiKey || '';
      llmModel.value = g.model || '';
      llmBaseUrl.placeholder = LLM_GLOBAL_PLACEHOLDERS.baseUrl;
      llmApiKey.placeholder = LLM_GLOBAL_PLACEHOLDERS.apiKey;
      llmModel.placeholder = LLM_GLOBAL_PLACEHOLDERS.model;
    } else {
      llmProvider.value = o.provider || '';
      llmBaseUrl.value = o.baseUrl || '';
      llmApiKey.value = o.apiKey || '';
      llmModel.value = o.model || '';
      llmBaseUrl.placeholder = g.baseUrl ? `Inherits: ${g.baseUrl}` : LLM_GLOBAL_PLACEHOLDERS.baseUrl;
      llmApiKey.placeholder = g.apiKey ? 'Inherits global API key' : LLM_GLOBAL_PLACEHOLDERS.apiKey;
      llmModel.placeholder = g.model ? `Inherits: ${g.model}` : LLM_GLOBAL_PLACEHOLDERS.model;
    }
    // Numerics: show override if defined, else global.
    _setSlider(llmTemperature, llmTemperatureVal, o.temperature ?? g.temperature ?? 0.7);
    llmMaxTokens.value = o.maxTokens ?? g.maxTokens ?? 128000;
    _setSlider(llmTopP, llmTopPVal, o.topP ?? g.topP ?? 1.0);

    // Chrome
    if (agentsSettingsLlmTitle) {
      agentsSettingsLlmTitle.textContent = isGlobal ? 'LLM Configuration' : 'LLM Overrides';
    }
    if (agentsSettingsOverrideHint) {
      agentsSettingsOverrideHint.classList.toggle('hidden', isGlobal);
    }
    if (agentsSettingsLlmHint) {
      agentsSettingsLlmHint.classList.toggle('hidden', !isGlobal);
    }
    if (agentsSettingsParamsCard) {
      const slot = document.getElementById(`settings-slot-${id}`);
      const hasParams = !isGlobal && !!slot && slot.children.length > 0;
      agentsSettingsParamsCard.classList.toggle('hidden', !hasParams);
      // All agent slots live in this card as siblings; hide the ones that
      // aren't selected so the pane is dedicated to a single agent.
      document
        .querySelectorAll('#agents-settings-params-card [id^="settings-slot-"]')
        .forEach((el) => {
          el.classList.toggle('hidden', el.id !== `settings-slot-${id}`);
        });
    }
    const llmCard = document.getElementById('agents-settings-llm-card');
    if (llmCard && llmCard.tagName === 'DETAILS') {
      llmCard.open = isGlobal;
      llmCard.classList.toggle('settings-disclosure-static', isGlobal);
    }
  }

  function _allAgentNavItems() {
    return document.querySelectorAll('.settings-nav-item[data-settings-target="agents"]');
  }

  function _updateAgentsPaneHeader(agentId) {
    const crumb = document.getElementById('agents-settings-crumb-name');
    const titleEl = document.getElementById('agents-settings-pane-title');
    const subtitleEl = document.getElementById('agents-settings-pane-subtitle');
    let name = 'Global Defaults';
    let subtitle = 'Connection and sampling defaults used by all agents unless overridden.';
    if (agentId !== '__global__') {
      const btn = document.querySelector(
        `.settings-nav-item[data-agent-id="${CSS.escape(agentId)}"] .settings-nav-label`
      );
      name = btn ? btn.textContent : agentId;
      subtitle = `Override connection and sampling for ${name}, or leave fields blank to inherit from Global Defaults.`;
    }
    if (crumb) crumb.textContent = name;
    if (titleEl) titleEl.textContent = name;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  function selectAgentSettingsRail(agentId) {
    _snapshotCurrentLlmForm();
    _settingsAgents.selectedId = agentId;
    for (const it of _allAgentNavItems()) {
      it.classList.toggle('active', it.dataset.agentId === agentId);
    }
    // Deactivate non-agents nav items while an agent is selected
    document
      .querySelectorAll('.settings-nav-item:not([data-settings-target="agents"])')
      .forEach((it) => it.classList.remove('active'));
    _updateAgentsPaneHeader(agentId);
    _loadLlmFormFromSelection();
  }

  function buildAgentSettingsRail(agents) {
    if (!agentsSettingsRail) return;
    agentsSettingsRail.innerHTML = '';
    const globalLlm = _settingsAgents.globalLlm || {};
    const globalHasModel = !!(globalLlm.model && String(globalLlm.model).trim());

    // Update the static Global Defaults dot state
    const globalItem = document.querySelector(
      '.settings-nav-item[data-agent-id="__global__"]'
    );
    if (globalItem) {
      globalItem.dataset.dotState = globalHasModel ? 'on' : 'warn';
      globalItem.title = globalHasModel
        ? 'Applies to all agents unless overridden'
        : 'No LLM model configured globally';
    }

    for (const agent of agents || []) {
      const override = _settingsAgents.agentLlm[agent.id];
      const overrideModel =
        override && override.model && String(override.model).trim();
      const requiresLlm = !!agent.manifest?.requires?.llm;
      let dotState = 'on';
      let title = 'Inherits Global Defaults';
      if (overrideModel) {
        dotState = 'override';
        title = `Override active · ${override.model}`;
      } else if (requiresLlm && !globalHasModel) {
        dotState = 'warn';
        title = 'No LLM model configured globally';
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-nav-item';
      btn.dataset.settingsTarget = 'agents';
      btn.dataset.agentId = agent.id;
      btn.dataset.dotState = dotState;
      btn.title = title;
      const label = agent.name || agent.title || agent.id;
      btn.innerHTML =
        `<span class="settings-nav-dot"></span>` +
        `<span class="settings-nav-label">${escapeHtml(label)}</span>`;
      agentsSettingsRail.appendChild(btn);
    }

    // Re-assert current selection (or fall back to Global Defaults).
    const stillPresent =
      _settingsAgents.selectedId === '__global__' ||
      (agents || []).some((a) => a.id === _settingsAgents.selectedId);
    const target = stillPresent ? _settingsAgents.selectedId : '__global__';
    _settingsAgents.selectedId = target;

    // If the Agents panel is currently visible, reflect selection in DOM.
    const agentsPanelVisible = !document
      .querySelector('.settings-panel[data-settings-panel="agents"]')
      ?.classList.contains('hidden');
    if (agentsPanelVisible) {
      for (const it of _allAgentNavItems()) {
        it.classList.toggle('active', it.dataset.agentId === target);
      }
      _updateAgentsPaneHeader(target);
    }
  }

  function _applyAgentsSettings(settings) {
    _settingsAgents.globalLlm = { ...(settings.llm || {}) };
    _settingsAgents.agentLlm = {};
    const agentsCfg = settings.agents || {};
    for (const [id, entry] of Object.entries(agentsCfg)) {
      if (entry && entry.llm && typeof entry.llm === 'object') {
        _settingsAgents.agentLlm[id] = { ...entry.llm };
      }
    }
  }

  // ── Generic per-agent settings (data-agent-setting) ───────────────────────
  // Agents own their settings UI via a `<template id="<id>-settings-fragment">`
  // in their ui.html. Each input declares `data-agent-setting="a.b.c"` as the
  // dotted settings path. These helpers read/write those paths so app.js
  // doesn't need to know any individual agent's settings schema.

  function _getSettingsPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  function _setSettingsPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  // Drop the deepest key and prune empty parents along the path.
  function _deleteSettingsPath(obj, path) {
    const parts = path.split('.');
    const chain = [obj];
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!chain[i] || typeof chain[i][k] !== 'object') return;
      chain.push(chain[i][k]);
    }
    delete chain[chain.length - 1][parts[parts.length - 1]];
    for (let i = chain.length - 1; i >= 1; i--) {
      if (Object.keys(chain[i]).length === 0) delete chain[i - 1][parts[i - 1]];
      else break;
    }
  }

  function readAgentSettingsIntoDom(settings) {
    const inputs = document.querySelectorAll('[data-agent-setting]');
    inputs.forEach((el) => {
      const path = el.dataset.agentSetting;
      const v = _getSettingsPath(settings, path);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : String(v);
    });
  }

  function writeAgentSettingsFromDom(agents) {
    const root = { agents };
    const inputs = document.querySelectorAll('[data-agent-setting]');
    inputs.forEach((el) => {
      const path = el.dataset.agentSetting;
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else if (el.type === 'number') {
        const n = Number(el.value);
        value = Number.isFinite(n) ? n : null;
      } else value = (el.value || '').trim();
      const isEmpty = value === '' || value == null || value === false;
      if (isEmpty) _deleteSettingsPath(root, path);
      else _setSettingsPath(root, path, value);
    });
  }

  let _llmFetchedModels = [];

  function getFilteredLLMModels(query = '') {
    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();
    if (!normalizedQuery) return [..._llmFetchedModels];
    return _llmFetchedModels.filter((model) => model.toLowerCase().includes(normalizedQuery));
  }

  function updateLLMModelHint(query = '') {
    if (!llmModelHint) return;
    if (_llmFetchedModels.length === 0) {
      llmModelHint.textContent = 'Fetch models to browse suggestions, or type a model name manually.';
      return;
    }

    const normalizedQuery = String(query || '').trim();
    const matches = getFilteredLLMModels(normalizedQuery).length;
    if (normalizedQuery) {
      llmModelHint.textContent = `${matches} of ${_llmFetchedModels.length} fetched model${_llmFetchedModels.length !== 1 ? 's' : ''} match "${query}".`;
    } else {
      llmModelHint.textContent = `${_llmFetchedModels.length} fetched model${_llmFetchedModels.length !== 1 ? 's are' : ' is'} available. Type to filter or pick one below.`;
    }
  }

  function hideLLMModelMenu() {
    if (llmModelMenu) llmModelMenu.classList.add('hidden');
  }

  function renderLLMModelMenu(query = '') {
    if (!llmModelMenu) return;
    updateLLMModelHint(query);
    if (_llmFetchedModels.length === 0) {
      llmModelMenu.innerHTML = '';
      hideLLMModelMenu();
      return;
    }

    const matches = getFilteredLLMModels(query);
    if (matches.length === 0) {
      llmModelMenu.innerHTML =
        '<div class="settings-combobox-empty">No fetched models match this filter.</div>';
    } else {
      llmModelMenu.innerHTML = matches
        .map(
          (model) =>
            `<button type="button" class="settings-combobox-option" data-model="${escapeHtml(model)}">${escapeHtml(model)}</button>`
        )
        .join('');
      llmModelMenu.querySelectorAll('.settings-combobox-option').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
          llmModel.value = btn.dataset.model || '';
          updateLLMModelHint('');
          hideLLMModelMenu();
          llmModel.focus();
        });
      });
    }
    llmModelMenu.classList.remove('hidden');
  }

  function showLLMModelMenu() {
    if (_llmFetchedModels.length === 0) return;
    renderLLMModelMenu('');
  }

  const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
  const DEFAULT_FONT_MONO = '\'JetBrains Mono\', \'Fira Code\', \'Cascadia Code\', \'Consolas\', monospace';

  function applyFontSettings(gen) {
    const root = document.documentElement.style;
    const ff = (gen?.fontFamily || '').trim();
    root.setProperty('--font-family', ff && ff !== 'System Default' ? `'${ff}', ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY);
    const fs = (gen?.fontSize || 14) + 'px';
    root.setProperty('--font-size', fs);
    root.setProperty('--font-mono', DEFAULT_FONT_MONO);
    root.setProperty('--font-size-mono', fs);
    root.setProperty('--ui-scale', gen?.uiScale || 1);
    // Propagate to existing terminal tabs (xterm.js snapshots font at creation)
    updateTerminalFonts();
  }

  let _fontListsPopulated = false;
  // Set a select's value, inserting a placeholder <option> if the desired value
  // isn't yet in the list (font list populates asynchronously).
  function setFontSelectValue(sel, value) {
    if (!sel) return;
    const v = (value === 'System Default') ? '' : (value || '');
    if (v && !Array.from(sel.options).some((o) => o.value === v)) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }
    sel.value = v;
  }
  function fillFontSelect(selectId, families) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'System Default';
    sel.appendChild(def);
    for (const family of families) {
      const opt = document.createElement('option');
      opt.value = family;
      opt.textContent = family;
      opt.style.fontFamily = `'${family.replace(/'/g, "\\'")}', ${DEFAULT_FONT_FAMILY}`;
      sel.appendChild(opt);
    }
    // If previously selected value isn't in the list, add it so we don't silently drop it
    if (prev && prev !== 'System Default' && !families.includes(prev)) {
      const opt = document.createElement('option');
      opt.value = prev;
      opt.textContent = prev + ' (not installed)';
      sel.appendChild(opt);
    }
    sel.value = prev === 'System Default' ? '' : prev;
  }
  function filterInstalled(families) {
    if (!document.fonts || typeof document.fonts.check !== 'function') return families;
    return families.filter((f) => {
      try {
        return document.fonts.check(`12px "${f.replace(/"/g, '\\"')}"`);
      } catch {
        return false;
      }
    });
  }
  function normalizeFamily(family) {
    if (!family) return '';
    const styleWords = [
      'Thin', 'Hairline', 'ExtraLight', 'UltraLight', 'Extra Light', 'Ultra Light',
      'Light', 'Regular', 'Normal', 'Book', 'Medium', 'DemiBold', 'SemiBold',
      'Demi Bold', 'Semi Bold', 'Demi', 'Semi', 'Bold', 'ExtraBold', 'UltraBold',
      'Extra Bold', 'Ultra Bold', 'Heavy', 'Black', 'ExtraBlack', 'Ultra Black',
      'Italic', 'Oblique', 'Slanted',
      'Condensed', 'SemiCondensed', 'ExtraCondensed', 'UltraCondensed',
      'Semi Condensed', 'Extra Condensed', 'Ultra Condensed', 'Narrow',
      'Expanded', 'SemiExpanded', 'ExtraExpanded', 'UltraExpanded',
      'Semi Expanded', 'Extra Expanded', 'Ultra Expanded', 'Wide',
    ];
    let out = family.trim();
    let changed = true;
    while (changed) {
      changed = false;
      for (const w of styleWords) {
        const re = new RegExp(`\\s+${w}$`, 'i');
        if (re.test(out)) {
          out = out.replace(re, '').trim();
          changed = true;
        }
      }
    }
    return out || family.trim();
  }
  async function populateFontLists() {
    if (_fontListsPopulated) return;
    let families = null;
    if (typeof window.queryLocalFonts === 'function') {
      try {
        const fonts = await window.queryLocalFonts();
        const roots = new Map();
        for (const f of fonts) {
          const root = normalizeFamily(f.family);
          if (!root) continue;
          const cur = roots.get(root.toLowerCase());
          if (!cur || root.length < cur.length) roots.set(root.toLowerCase(), root);
        }
        families = Array.from(roots.values()).sort((a, b) => a.localeCompare(b));
      } catch {
        families = null;
      }
    }
    if (!families || !families.length) {
      const curated = ['Inter', 'Noto Sans', 'Roboto', 'Georgia', 'Merriweather',
        'Lora', 'Helvetica Neue', 'Helvetica', 'Arial', 'Times New Roman',
        'Courier New', 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Menlo',
        'Consolas', 'Monaco', 'SF Pro', 'Segoe UI', 'Ubuntu', 'Cantarell'];
      families = filterInstalled(curated);
    }
    if (!families.length) return;
    fillFontSelect('general-font-family', families);
    _fontListsPopulated = true;
  }

  function openSettingsModal() {
    settingsModal.classList.remove('hidden');
    switchSettingsPanel('remote-storage');
    populateFontLists();
    webdavTestResult.textContent = '';
    webdavTestResult.className = 'settings-test-result';
    cloudTestResult.textContent = '';
    cloudTestResult.className = 'settings-test-result';
    cloudChangePasswordResult.textContent = '';
    cloudChangePasswordResult.className = 'settings-test-result';
    if (llmTestResult) {
      llmTestResult.textContent = '';
      llmTestResult.className = 'settings-test-result';
      llmTestResult.title = '';
    }
    hideLLMModelMenu();
    updateLLMModelHint('');
    if (window.electronAPI && window.electronAPI.loadSettings) {
      window.electronAPI.loadSettings().then(async (s) => {
        if (!s) return;
        // Legacy migration: top-level `mindmap` block moves under agents.mindmap.params.
        if (s.mindmap && !s.agents?.mindmap?.params) {
          s.agents = {
            ...(s.agents || {}),
            mindmap: { ...(s.agents?.mindmap || {}), params: s.mindmap },
          };
        }
        setRemoteProvider(getPreferredRemoteProvider(s));
        setPagesWebdavRoot(s.webdav?.pagesRoot || '/');
        const wdav = s.webdav || {};
        settingWebdavUrl.value = wdav.url || '';
        settingWebdavUsername.value = wdav.username || '';
        settingWebdavPassword.value = wdav.password || '';
        // SSH tunnel settings
        const tun = wdav.sshTunnel || {};
        if (settingWebdavSshEnabled) settingWebdavSshEnabled.checked = !!tun.enabled;
        if (webdavSshFields) webdavSshFields.classList.toggle('hidden', !tun.enabled);
        if (settingWebdavSshHost) settingWebdavSshHost.value = tun.host || '';
        if (settingWebdavSshPort) settingWebdavSshPort.value = tun.port || 22;
        if (settingWebdavSshUsername) settingWebdavSshUsername.value = tun.username || '';
        if (settingWebdavSshKey) settingWebdavSshKey.value = tun.privateKeyPath || '';
        if (settingWebdavSshPassphrase) settingWebdavSshPassphrase.value = tun.passphrase || '';
        // LLM settings
        const llm = s.llm || {};
        llmProvider.value = llm.provider || 'openai';
        llmBaseUrl.value = llm.baseUrl || '';
        llmApiKey.value = llm.apiKey || '';
        llmModel.value = llm.model || '';
        const temp = llm.temperature ?? 0.7;
        llmTemperature.value = temp;
        llmTemperatureVal.textContent = temp.toFixed(2);
        llmMaxTokens.value = llm.maxTokens ?? 128000;
        const tp = llm.topP ?? 1.0;
        llmTopP.value = tp;
        llmTopPVal.textContent = tp.toFixed(2);
        updateLLMModelHint('');
        const mindmap = getMindmapSettings(s);
        const mmScanRoot = getMindmapSettingsEl('mindmap-scan-root');
        const mmOutputDir = getMindmapSettingsEl('mindmap-output-dir');
        const mmStateFile = getMindmapSettingsEl('mindmap-state-file');
        const mmMaxFileMb = getMindmapSettingsEl('mindmap-max-file-mb');
        const mmParallel = getMindmapSettingsEl('mindmap-parallel-inference');
        const mmCtxChars = getMindmapSettingsEl('mindmap-max-context-chars');
        const mmRestructure = getMindmapSettingsEl('mindmap-restructure-threshold');
        if (mmScanRoot) mmScanRoot.value = mindmap.scanRoot;
        if (mmOutputDir) mmOutputDir.value = mindmap.outputDir;
        if (mmStateFile) mmStateFile.value = mindmap.stateFilePath;
        if (mmMaxFileMb) {
          mmMaxFileMb.value = String(Math.max(1, Math.round(mindmap.maxFileBytes / (1024 * 1024))));
        }
        if (mmParallel) mmParallel.value = String(mindmap.parallelInference);
        if (mmCtxChars) mmCtxChars.value = String(mindmap.maxContextChars);
        if (mmRestructure) {
          mmRestructure.value = String(Math.round(mindmap.restructureThreshold * 100));
        }
        // LLM Wiki settings
        const wikiParams = s.agents?.['llm-wiki']?.params || {};
        const wikiRootEl = document.getElementById('llm-wiki-root');
        const wikiMaxRoundsEl = document.getElementById('llm-wiki-max-rounds');
        if (wikiRootEl) wikiRootEl.value = wikiParams.wikiRoot || '/wiki/';
        if (wikiMaxRoundsEl) {
          wikiMaxRoundsEl.value = String(wikiParams.maxRounds || 40);
        }
        // Generic per-agent settings from `data-agent-setting` inputs.
        readAgentSettingsIntoDom(s);
        // RSS settings
        const rss = s.rss || {};
        if (rssRefreshIntervalEl) rssRefreshIntervalEl.value = rss.refreshIntervalMinutes || 30;
        if (rssBackgroundRefreshEl) rssBackgroundRefreshEl.checked = rss.backgroundRefresh !== false;
        if (rssOutputDirEl) rssOutputDirEl.value = rss.outputDir || '/rss';
        if (rssSyncEnabledEl) rssSyncEnabledEl.checked = rss.syncEnabled !== false;
        renderRssFeedsTable();
        // General settings
        const gen = s.general || {};
        _stripFrontMatter = gen.stripFrontMatter ?? true;
        generalStripFrontMatterEl.checked = _stripFrontMatter;
        if (generalFontFamily) setFontSelectValue(generalFontFamily, gen.fontFamily || '');
        if (generalFontSize) generalFontSize.value = gen.fontSize || 14;
        if (generalUiScale) generalUiScale.value = gen.uiScale || 1;
        applyFontSettings(gen);
        // Cloud settings
        const cl = s.cloud || {};
        settingCloudApiUrl.value = cl.apiBaseUrl || '';
        settingCloudEmail.value = cl.email || '';
        // Cloud Agents settings (base URL + bearer token)
        const ca = s.cloudAgents || {};
        if (settingCloudAgentsBaseUrl) {
          settingCloudAgentsBaseUrl.value = ca.baseUrl || ca.apiBaseUrl || '';
        }
        if (settingCloudAgentsToken) {
          settingCloudAgentsToken.value = ca.token || '';
        }
        // Agents subtab rail — seed state, build rail, reset to Global Defaults.
        _applyAgentsSettings(s);
        _settingsAgents.selectedId = '__global__';
        try {
          const agents = window.electronAPI.listAgents
            ? await window.electronAPI.listAgents()
            : [];
          buildAgentSettingsRail(agents);
        } catch {
          buildAgentSettingsRail([]);
        }
        _loadLlmFormFromSelection();
      });
    }
    if (window.electronAPI && window.electronAPI.cloudIsLoggedIn) {
      window.electronAPI.cloudIsLoggedIn().then((r) => updateCloudStatus(r.loggedIn));
    }
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
    settingCloudPassword.value = '';
    settingCloudOldPassword.value = '';
    settingCloudNewPassword.value = '';
  }

  if (window.electronAPI && window.electronAPI.loadSettings) {
    window.electronAPI.loadSettings().then((s) => {
      if (!s) return;
      _stripFrontMatter = s.general?.stripFrontMatter ?? true;
      applyFontSettings(s.general);
      setRemoteProvider(getPreferredRemoteProvider(s));
      setPagesWebdavRoot(s.webdav?.pagesRoot || '/');
    });
  }

  if (generalRemoteProviderEl) {
    generalRemoteProviderEl.addEventListener('change', () => setRemoteProvider(generalRemoteProviderEl.value));
  }

  btnSettings.addEventListener('click', openSettingsModal);
  btnSettingsClose.addEventListener('click', closeSettingsModal);
  btnSettingsCancel.addEventListener('click', closeSettingsModal);

  // SSH tunnel field visibility toggle
  if (settingWebdavSshEnabled) {
    settingWebdavSshEnabled.addEventListener('change', () => {
      if (webdavSshFields) {
        webdavSshFields.classList.toggle('hidden', !settingWebdavSshEnabled.checked);
      }
    });
  }

  // SSH private key browse button
  if (btnWebdavSshBrowseKey && window.electronAPI && window.electronAPI.openPrivateKey) {
    btnWebdavSshBrowseKey.addEventListener('click', async () => {
      const keyPath = await window.electronAPI.openPrivateKey();
      if (keyPath && settingWebdavSshKey) settingWebdavSshKey.value = keyPath;
    });
  }

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  btnSettingsSave.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const existing = await window.electronAPI.loadSettings();
    // Snapshot the LLM form into whichever rail row is currently selected.
    _snapshotCurrentLlmForm();
    const globalLlm = _settingsAgents.globalLlm || getLLMSettingsFromForm();
    // Start from any pre-existing agents config (preserves entries for agents
    // this modal didn't edit — e.g., params of a 3rd-party agent we don't know
    // about). Then overlay the LLM overrides and MindMap params we collected.
    const agents = { ...(existing?.agents || {}) };
    for (const [id, override] of Object.entries(_settingsAgents.agentLlm)) {
      const hasOverride = override && Object.keys(override).length > 0;
      if (hasOverride) {
        agents[id] = { ...(agents[id] || {}), llm: override };
      } else if (agents[id]?.llm) {
        // User cleared all overrides — drop the llm block.
        const { llm, ...rest } = agents[id];
        agents[id] = rest;
      }
      // If the entry became an empty object, drop it.
      if (agents[id] && Object.keys(agents[id]).length === 0) delete agents[id];
    }
    // MindMap params: pulled from the form (DOM slot is always present).
    const mindmapParams = getMindmapSettingsFromForm(existing);
    if (mindmapParams) {
      agents.mindmap = { ...(agents.mindmap || {}), params: mindmapParams };
    }
    // LLM Wiki params
    const wikiRootEl = document.getElementById('llm-wiki-root');
    const wikiMaxRoundsEl = document.getElementById('llm-wiki-max-rounds');
    if (wikiRootEl || wikiMaxRoundsEl) {
      const wikiRootRaw = wikiRootEl?.value?.trim() || '/wiki/';
      const wikiRoot = wikiRootRaw.startsWith('/') ? wikiRootRaw : `/${wikiRootRaw}`;
      const maxRoundsRaw = parseInt(wikiMaxRoundsEl?.value || '', 10);
      const maxRounds = Number.isFinite(maxRoundsRaw) && maxRoundsRaw > 0
        ? Math.max(5, Math.min(200, maxRoundsRaw))
        : 40;
      agents['llm-wiki'] = {
        ...(agents['llm-wiki'] || {}),
        params: { wikiRoot, maxRounds },
      };
    }
    // Generic per-agent settings: each agent's settings fragment declares
    // inputs with `data-agent-setting="agents.<id>.<path>"`. We read each
    // input and set/unset the corresponding path so agents can own their
    // own settings without app.js needing to know about them.
    writeAgentSettingsFromDom(agents);
    const settings = {
      webdav: {
        url: settingWebdavUrl.value.trim(),
        username: settingWebdavUsername.value.trim(),
        password: settingWebdavPassword.value,
        pagesRoot: existing?.webdav?.pagesRoot || _pagesWebdavRoot || '/',
        sshTunnel: {
          enabled: settingWebdavSshEnabled ? settingWebdavSshEnabled.checked : false,
          host: settingWebdavSshHost ? settingWebdavSshHost.value.trim() : '',
          port: settingWebdavSshPort ? Number(settingWebdavSshPort.value) || 22 : 22,
          username: settingWebdavSshUsername ? settingWebdavSshUsername.value.trim() : '',
          privateKeyPath: settingWebdavSshKey ? settingWebdavSshKey.value.trim() : '',
          passphrase: settingWebdavSshPassphrase ? settingWebdavSshPassphrase.value : '',
        },
      },
      llm: globalLlm,
      general: {
        stripFrontMatter: generalStripFrontMatterEl.checked,
        remoteProvider: generalRemoteProviderEl.value,
        fontFamily: generalFontFamily?.value?.trim() || '',
        fontSize: parseInt(generalFontSize?.value, 10) || 14,
        uiScale: parseFloat(generalUiScale?.value) || 1,
      },
      agents,
    };
    // Preserve cloud tokens/FEK fields; only update apiBaseUrl from the UI
    settings.cloud = { ...(existing?.cloud || {}), apiBaseUrl: settingCloudApiUrl.value.trim() };
    // Cloud Agents: base URL + bearer token. Preserves legacy apiBaseUrl/executionMode.
    settings.cloudAgents = {
      ...(existing?.cloudAgents || {}),
      baseUrl: settingCloudAgentsBaseUrl ? settingCloudAgentsBaseUrl.value.trim() : (existing?.cloudAgents?.baseUrl || ''),
      token: settingCloudAgentsToken ? settingCloudAgentsToken.value : (existing?.cloudAgents?.token || ''),
    };
    // RSS settings (feeds live in _rssState.feeds; other fields pulled from form)
    settings.rss = {
      ...(existing?.rss || {}),
      feeds: _rssState ? _rssState.feeds.map((f) => ({ id: f.id, url: f.url, title: f.title })) : (existing?.rss?.feeds || []),
      refreshIntervalMinutes: Math.max(5, parseInt(rssRefreshIntervalEl?.value, 10) || 30),
      backgroundRefresh: rssBackgroundRefreshEl ? rssBackgroundRefreshEl.checked : true,
      outputDir: (rssOutputDirEl?.value || '/rss').trim() || '/rss',
      syncEnabled: rssSyncEnabledEl ? rssSyncEnabledEl.checked : true,
    };
    await window.electronAPI.saveSettings(settings);
    _stripFrontMatter = generalStripFrontMatterEl.checked;
    applyFontSettings(settings.general);
    setPagesWebdavRoot(settings.webdav.pagesRoot);
    showToast('Settings saved', 'success');
    closeSettingsModal();
    _pagesInitialized = false;
    if (currentMode === 'pages') pagesInit();
  });

  // ── Reload agents (explicit; no live fs watcher) ──

  if (btnAgentsReload) {
    btnAgentsReload.addEventListener('click', async () => {
      if (!window.electronAPI?.reloadAgents) return;
      btnAgentsReload.disabled = true;
      btnAgentsReload.classList.add('is-loading');
      try {
        await window.electronAPI.reloadAgents();
        const agents = window.electronAPI.listAgents
          ? await window.electronAPI.listAgents()
          : [];
        // Prune overrides for agents that no longer exist, so Save doesn't
        // re-write dead entries to disk.
        const liveIds = new Set(agents.map((a) => a.id));
        for (const id of Object.keys(_settingsAgents.agentLlm)) {
          if (!liveIds.has(id)) delete _settingsAgents.agentLlm[id];
        }

        // Re-inject per-agent UI fragments so edits to each agent's ui.html
        // (params block + settings template) actually take effect on Reload.
        // Clear stale agent-params-<id> blocks and settings-slot-<id> contents
        // first, then force-refresh the fetch cache for every agent.
        if (agentUiHost) {
          agentUiHost.querySelectorAll('[id^="agent-params-"]').forEach((el) => el.remove());
        }
        document.querySelectorAll('[id^="settings-slot-"]').forEach((slot) => {
          slot.innerHTML = '';
        });
        _agentManifestById.clear();
        _agentsListCache = agents;
        for (const agent of agents) {
          _agentManifestById.set(agent.id, agent.manifest);
          await injectAgentUi(agent, { forceRefresh: true });
        }

        // Rebuild the Agents-mode sidebar list in case agents were added/removed.
        if (agentsList) {
          agentsList.innerHTML = '';
          for (const agent of agents) {
            const li = document.createElement('li');
            li.className = 'agents-list-item';
            li.dataset.agentId = agent.id;
            li.innerHTML = `<span class="agents-list-item-name">${escapeHtml(agent.name)}</span>`;
            li.addEventListener('click', () => selectAgent(agent));
            agentsList.appendChild(li);
          }
        }
        // If the selected agent was removed, fall back to none.
        if (selectedAgentId && !liveIds.has(selectedAgentId)) {
          selectedAgentId = null;
          if (agentsEmptyState) agentsEmptyState.classList.remove('hidden');
          if (agentsWorkspacePanel) agentsWorkspacePanel.classList.add('hidden');
        }

        buildAgentSettingsRail(agents);
        _loadLlmFormFromSelection();
        showToast('Agents reloaded', 'success');
      } catch (err) {
        showToast(err?.message || 'Reload failed', 'error');
      } finally {
        btnAgentsReload.disabled = false;
        btnAgentsReload.classList.remove('is-loading');
      }
    });
  }

  // ── WebDAV test connection ──

  btnWebdavTest.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    webdavTestResult.textContent = 'Testing…';
    webdavTestResult.className = 'settings-test-result';
    const result = await window.electronAPI.webdavTestConnection();
    if (result.success) {
      webdavTestResult.textContent = `Connected (${result.latency}ms)`;
      webdavTestResult.className = 'settings-test-result test-ok';
    } else {
      webdavTestResult.textContent = result.error || 'Connection failed';
      webdavTestResult.className = 'settings-test-result test-fail';
    }
  });

  // ════════════════════════════════════════════
  //  Cloud handlers
  // ════════════════════════════════════════════

  function updateCloudStatus(loggedIn, email) {
    if (loggedIn) {
      cloudAuthStatus.textContent = email ? `Logged in as ${email}` : 'Logged in';
      cloudAuthStatus.className = 'settings-hint-block key-ok';
      btnCloudLogin.classList.add('hidden');
      btnCloudRegister.classList.add('hidden');
      btnCloudLogout.classList.remove('hidden');
    } else {
      cloudAuthStatus.textContent = 'Not logged in';
      cloudAuthStatus.className = 'settings-hint-block';
      btnCloudLogin.classList.remove('hidden');
      btnCloudRegister.classList.remove('hidden');
      btnCloudLogout.classList.add('hidden');
    }
  }

  btnCloudRegister.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.cloudRegister({
      email: settingCloudEmail.value.trim(),
      password: settingCloudPassword.value,
    });
    settingCloudPassword.value = '';
    if (result.success) {
      showToast('Account created — please log in', 'success');
    } else {
      showToast(result.error || 'Registration failed', 'error');
    }
  });

  btnCloudLogin.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.cloudLogin({
      email: settingCloudEmail.value.trim(),
      password: settingCloudPassword.value,
    });
    settingCloudPassword.value = '';
    if (result.success) {
      updateCloudStatus(true, result.email);
      showToast('Logged in to cloud', 'success');
    } else {
      showToast(result.error || 'Login failed', 'error');
    }
  });

  btnCloudLogout.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.cloudLogout();
    updateCloudStatus(false);
    showToast('Logged out from cloud', 'success');
  });

  btnCloudTest.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    cloudTestResult.textContent = 'Testing...';
    cloudTestResult.className = 'settings-test-result';
    const result = await window.electronAPI.cloudTestConnection();
    if (result.success) {
      cloudTestResult.textContent = `OK — ${result.email} (${result.latencyMs}ms)`;
      cloudTestResult.className = 'settings-test-result test-ok';
    } else {
      cloudTestResult.textContent = result.error || 'Connection failed';
      cloudTestResult.className = 'settings-test-result test-fail';
    }
  });

  btnCloudChangePassword.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    cloudChangePasswordResult.textContent = 'Changing...';
    cloudChangePasswordResult.className = 'settings-test-result';
    const result = await window.electronAPI.cloudChangePassword({
      oldPassword: settingCloudOldPassword.value,
      newPassword: settingCloudNewPassword.value,
    });
    settingCloudOldPassword.value = '';
    settingCloudNewPassword.value = '';
    if (result.success) {
      cloudChangePasswordResult.textContent = 'Password changed — please log in again';
      cloudChangePasswordResult.className = 'settings-test-result test-ok';
      updateCloudStatus(false);
    } else {
      cloudChangePasswordResult.textContent = result.error || 'Failed';
      cloudChangePasswordResult.className = 'settings-test-result test-fail';
    }
  });

  // ════════════════════════════════════════════
  //  LLM Settings handlers
  // ════════════════════════════════════════════

  llmTemperature.addEventListener('input', () => {
    llmTemperatureVal.textContent = parseFloat(llmTemperature.value).toFixed(2);
  });

  llmTopP.addEventListener('input', () => {
    llmTopPVal.textContent = parseFloat(llmTopP.value).toFixed(2);
  });

  const LLM_PRESETS = {
    openai: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    anthropic: {
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
    },
    ollama: { provider: 'openai', baseUrl: 'http://localhost:11434/v1', model: '' },
    vllm: { provider: 'openai', baseUrl: 'http://localhost:8000/v1', model: '' },
    llamacpp: { provider: 'openai', baseUrl: 'http://localhost:8080/v1', model: '' },
  };

  document.querySelectorAll('[data-llm-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const p = LLM_PRESETS[chip.dataset.llmPreset];
      if (!p) return;
      llmProvider.value = p.provider;
      llmBaseUrl.value = p.baseUrl;
      if (p.model) llmModel.value = p.model;
    });
  });

  btnFetchModels.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    btnFetchModels.disabled = true;
    btnFetchModels.textContent = 'Fetching…';
    const result = await window.electronAPI.fetchLLMModels({ config: getLLMSettingsFromForm() });
    btnFetchModels.disabled = false;
    btnFetchModels.textContent = 'Fetch';
    if (result.success) {
      _llmFetchedModels = [...(result.models || [])];
      renderLLMModelMenu('');
      showToast(
        `Fetched ${result.models.length} model${result.models.length !== 1 ? 's' : ''}`,
        'success'
      );
    } else {
      showToast(result.error || 'Failed to fetch models', 'error');
    }
  });

  if (llmModel) {
    llmModel.addEventListener('focus', () => showLLMModelMenu());
    llmModel.addEventListener('input', () => {
      if (_llmFetchedModels.length > 0) renderLLMModelMenu(llmModel.value);
      else updateLLMModelHint('');
    });
    llmModel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideLLMModelMenu();
      } else if (e.key === 'ArrowDown' && _llmFetchedModels.length > 0) {
        e.preventDefault();
        renderLLMModelMenu(llmModel.value);
        llmModelMenu?.querySelector('.settings-combobox-option')?.focus();
      }
    });
  }

  if (llmModelCombobox) {
    document.addEventListener('click', (e) => {
      if (!llmModelCombobox.contains(e.target)) {
        hideLLMModelMenu();
      }
    });
  }

  if (btnTestLLM && llmTestResult) {
    btnTestLLM.addEventListener('click', async () => {
      if (!window.electronAPI?.testLLMConnection) return;
      btnTestLLM.disabled = true;
      llmTestResult.textContent = 'Testing…';
      llmTestResult.className = 'settings-test-result';
      llmTestResult.title = '';
      const result = await window.electronAPI.testLLMConnection({ config: getLLMSettingsFromForm() });
      btnTestLLM.disabled = false;
      if (result.success) {
        const preview = result.preview ? ` — ${result.preview}` : '';
        llmTestResult.textContent = `Connected (${result.latencyMs}ms)${preview}`;
        llmTestResult.className = 'settings-test-result test-ok';
        llmTestResult.title = result.preview || '';
      } else {
        llmTestResult.textContent = result.error || 'Connection failed';
        llmTestResult.className = 'settings-test-result test-fail';
      }
    });
  }

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
  //  Large File Handling
  // ════════════════════════════════════════════

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function escapeHtmlAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showLargeFileWarning(fileName, fileSize) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

      const card = document.createElement('div');
      card.className = 'modal-card';
      card.style.cssText = 'max-width:440px;width:90%';
      card.innerHTML =
        '<div class="modal-header"><h3 class="modal-title">Large File</h3></div>' +
        '<div style="padding:16px 24px">' +
          '<p style="margin:0 0 8px"><strong>' + escapeHtmlAttr(fileName) + '</strong> is ' + formatFileSize(fileSize) + '.</p>' +
          '<p style="margin:0;color:var(--text-secondary)">Large files use virtual scrolling. Some features (Mermaid diagrams, find highlighting) may be limited.</p>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 24px;border-top:1px solid var(--border)">' +
          '<button class="btn btn-secondary" id="large-file-cancel">Cancel</button>' +
          '<button class="btn btn-primary" id="large-file-confirm">Open Anyway</button>' +
        '</div>';
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      const cleanup = (result) => { overlay.remove(); resolve(result); };
      card.querySelector('#large-file-cancel').onclick = () => cleanup(false);
      card.querySelector('#large-file-confirm').onclick = () => cleanup(true);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    });
  }

  // ════════════════════════════════════════════
  //  Find in Page (custom renderer implementation; no webContents.findInPage)
  // ════════════════════════════════════════════

  let findBarVisible = false;
  let customFindHighlightSpans = [];
  let customFindMatchSpans = [];
  let customFindCurrentIndex = 0;
  let customFindMatchCount = 0;
  let _vtrFindActive = false;  // true when find is using VirtualTextRenderer search
  let _vtrFindDebounce = null;

  function _getActiveVirtualRenderer() {
    if (currentMode !== 'reader') return null;
    const tab = readerTabs.find((t) => t.id === activeReaderTabId);
    return (tab && tab.largeFile && tab.largeFile.virtualRenderer) ? tab.largeFile.virtualRenderer : null;
  }

  function getSearchableRoot() {
    if (currentMode === 'reader') return markdownBody;
    if (isEditorSubMode('md-editor')) return mdEditorPreviewEl;
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

  // Shared SearchAddon decoration palette (warm amber highlights).
  const _TERM_FIND_DECORATIONS = {
    matchBackground: 'rgba(255, 223, 84, 0.3)',
    matchBorder: 'rgba(255, 223, 84, 0.8)',
    matchOverviewRuler: '#f1c40f',
    activeMatchBackground: 'rgba(255, 140, 0, 0.7)',
    activeMatchBorder: '#ff8c00',
    activeMatchColorOverviewRuler: '#ff8c00',
  };
  function _termFindOptions() {
    return {
      caseSensitive: !!(findCaseSensitive && findCaseSensitive.checked),
      decorations: _TERM_FIND_DECORATIONS,
    };
  }
  function _activeTermSearchAddon() {
    const tab = _termTabs.find((t) => t.id === _activeTermTabId);
    return tab && tab.searchAddon ? tab.searchAddon : null;
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
    if (currentMode === 'terminal') {
      const addon = _activeTermSearchAddon();
      if (addon && findInput.value) addon.findNext(findInput.value, _termFindOptions());
      return;
    }
    if (customFindMatchCount === 0) return;
    customFindCurrentIndex = (customFindCurrentIndex + 1) % customFindMatchCount;
    if (_vtrFindActive) {
      const vr = _getActiveVirtualRenderer();
      if (vr) vr.highlightMatch(customFindCurrentIndex);
      updateFindMatchCountDisplay();
      return;
    }
    const spans = customFindMatchSpans[customFindCurrentIndex];
    if (spans && spans[0]) spans[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    updateFindMatchCountDisplay();
  }

  function customFindPrev() {
    if (currentMode === 'terminal') {
      const addon = _activeTermSearchAddon();
      if (addon && findInput.value) addon.findPrevious(findInput.value, _termFindOptions());
      return;
    }
    if (customFindMatchCount === 0) return;
    customFindCurrentIndex =
      (customFindCurrentIndex - 1 + customFindMatchCount) % customFindMatchCount;
    if (_vtrFindActive) {
      const vr = _getActiveVirtualRenderer();
      if (vr) vr.highlightMatch(customFindCurrentIndex);
      updateFindMatchCountDisplay();
      return;
    }
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
    _vtrFindActive = false;
    if (_vtrFindDebounce) { clearTimeout(_vtrFindDebounce); _vtrFindDebounce = null; }
    // Clear virtual renderer search highlights
    const vr = _getActiveVirtualRenderer();
    if (vr) { vr._searchResults = []; vr._searchHighlightIndex = -1; }
    // Clear terminal SearchAddon decorations across all terminal tabs
    for (const tab of _termTabs) {
      if (tab.searchAddon) { try { tab.searchAddon.clearDecorations(); } catch (_) {} }
    }
  }

  function triggerFind() {
    const text = findInput.value;
    clearCustomFindHighlights();
    _vtrFindActive = false;

    if (currentMode === 'terminal') {
      const addon = _activeTermSearchAddon();
      if (!text) {
        if (addon) { try { addon.clearDecorations(); } catch (_) {} }
        customFindMatchCount = 0;
        customFindCurrentIndex = 0;
        findMatchCount.textContent = '';
        findMatchCount.classList.remove('no-results');
        return;
      }
      if (addon) addon.findNext(text, _termFindOptions());
      return;
    }

    if (!text) {
      findMatchCount.textContent = '';
      findMatchCount.classList.remove('no-results');
      return;
    }

    // Virtual text renderer: string-based search instead of DOM walker
    const vr = _getActiveVirtualRenderer();
    if (vr) {
      const caseSensitive = findCaseSensitive && findCaseSensitive.checked;
      vr._searchResults = vr.searchLines(text, caseSensitive);
      customFindMatchCount = vr._searchResults.length;
      customFindCurrentIndex = 0;
      _vtrFindActive = true;
      if (customFindMatchCount > 0) vr.highlightMatch(0);
      updateFindMatchCountDisplay();
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

  function _triggerFindDebounced() {
    if (_vtrFindDebounce) clearTimeout(_vtrFindDebounce);
    const vr = _getActiveVirtualRenderer();
    if (vr) {
      _vtrFindDebounce = setTimeout(triggerFind, 300);
    } else {
      triggerFind();
    }
  }

  findInput.addEventListener('input', _triggerFindDebounced);
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

  // ════════════════════════════════════════════
  //  Agents
  // ════════════════════════════════════════════

  let selectedAgentId = null;
  let _lastAgentResult = null;
  const _agentRunState = new Map(); // agentId → { status, result }
  const _agentLogStash = new Map(); // agentId → detached div holding log nodes when switched away
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Sidebar population ──

  // Agents whose manifest declares entry.ui.html get a bespoke params block
  // injected from the agent's own ui.html at startup. Each injected fragment's
  // outer wrapper has id="agent-params-<agentId>" so selectAgent can toggle
  // visibility by id. Agents without entry.ui.html fall back to the Tier-0
  // auto-form rendered from manifest.params.
  const _agentManifestById = new Map();

  async function injectAgentUi(agent, { forceRefresh = false } = {}) {
    const uiHtml = agent.manifest?.entry?.ui?.html;
    if (!uiHtml) return;
    try {
      const cacheBuster = forceRefresh ? `?t=${Date.now()}` : '';
      const res = await fetch(`agents/${agent.id}/${uiHtml}${cacheBuster}`, forceRefresh ? { cache: 'no-store' } : undefined);
      if (!res.ok) return;
      const text = await res.text();
      const scratch = document.createElement('div');
      scratch.innerHTML = text;

      // Params block: inject into #agent-ui-host as hidden; selectAgent toggles it.
      const paramBlock = scratch.querySelector(`#agent-params-${agent.id}`);
      if (paramBlock && agentUiHost) {
        const existing = document.getElementById(`agent-params-${agent.id}`);
        if (existing && forceRefresh) existing.remove();
        if (forceRefresh || !existing) {
          paramBlock.classList.add('hidden');
          agentUiHost.appendChild(paramBlock);
        }
      }

      // Settings fragment: inject into the global settings modal slot. The
      // slot element is created on demand inside #agents-settings-params-card
      // so agents can add/remove settings by dropping folders without edits
      // to index.html.
      const settingsTpl = scratch.querySelector(`#${agent.id}-settings-fragment`);
      if (settingsTpl) {
        let settingsSlot = document.getElementById(`settings-slot-${agent.id}`);
        if (!settingsSlot) {
          const container = document.getElementById('agents-settings-params-card');
          if (container) {
            settingsSlot = document.createElement('div');
            settingsSlot.id = `settings-slot-${agent.id}`;
            container.appendChild(settingsSlot);
          }
        }
        if (settingsSlot) {
          if (forceRefresh) settingsSlot.innerHTML = '';
          if (settingsSlot.children.length === 0) {
            settingsSlot.appendChild(settingsTpl.content.cloneNode(true));
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to inject UI for agent "${agent.id}":`, err);
    }
  }

  async function initAgentsList() {
    if (!window.electronAPI?.listAgents) return;
    const agents = await window.electronAPI.listAgents();
    agentsList.innerHTML = '';
    _agentManifestById.clear();
    // Keep a list for openAgent() lookups.
    _agentsListCache = agents;
    for (const agent of agents) {
      _agentManifestById.set(agent.id, agent.manifest);
      await injectAgentUi(agent);
      const li = document.createElement('li');
      li.className = 'agents-list-item';
      li.dataset.agentId = agent.id;
      li.innerHTML = `<span class="agents-list-item-name">${escapeHtml(agent.name)}</span>`;
      li.addEventListener('click', () => selectAgent(agent));
      agentsList.appendChild(li);
    }
  }

  // Programmatic agent open.
  // opts.resume = { question, transcript, language } triggers a cloud run with
  // the transcript attached so the server can replay context.
  let _agentsListCache = [];
  async function openAgent(agentId, opts = {}) {
    if (currentMode !== 'agents') switchMode('agents');
    if (!_agentsListCache.length && window.electronAPI?.listAgents) {
      _agentsListCache = await window.electronAPI.listAgents();
    }
    const agent = _agentsListCache.find((a) => a.id === agentId);
    if (!agent) return false;
    selectAgent(agent);
    // Prefill auto-form fields with resume data where available.
    if (opts.resume && agentParamsAuto) {
      const qEl = agentParamsAuto.querySelector('[data-param-name="question"]');
      const lEl = agentParamsAuto.querySelector('[data-param-name="language"]');
      if (qEl) qEl.value = opts.resume.question || '';
      if (lEl && opts.resume.language) lEl.value = opts.resume.language;
    }
    // For cloud agents, mount the Tier-2 UI directly with the resume payload.
    if (agent.manifest?.execution === 'cloud' && opts.resume) {
      const ui = agent.manifest?.entry?.ui || {};
      if (!ui.js || !ui.html) return false;
      if (agentParamsAuto) agentParamsAuto.classList.add('hidden');
      if (agentUiHost) {
        agentUiHost.classList.remove('hidden');
        agentUiHost.innerHTML = '';
      }
      try {
        await window.__agentUiHost.mount(
          agentId,
          agent.manifest,
          agentUiHost,
          { params: { resume: opts.resume, language: opts.resume.language || 'English', question: opts.resume.question } },
          `agents/${agentId}`,
        );
        agentUiHost.dataset.cloudAgentMounted = agentId;
      } catch (err) {
        console.warn('openAgent mount failed', err);
        return false;
      }
    }
    return true;
  }
  // Expose for hooks (e.g. reader toolbar button) that live outside this IIFE.
  window.openAgent = openAgent;

  // ── Agent selection ──

  function agentHasBespokeUi(agentId) {
    return !!_agentManifestById.get(agentId)?.entry?.ui?.html;
  }

  // Tier-0 auto-form is owned by agents/_runtime/ui-host.js; these are thin
  // delegates so existing call sites keep working.
  function renderAutoForm(container, manifest) {
    return window.__agentUiHost.renderAutoForm(container, manifest);
  }
  function collectAutoFormParams(container) {
    return window.__agentUiHost.collectAutoFormParams(container);
  }

  function selectAgent(agent) {
    const prevAgentId = agentsLog.dataset.agent;

    // Stash current agent's log content if switching to a different agent
    if (prevAgentId && prevAgentId !== agent.id && agentsLog.children.length > 0) {
      const stash = document.createElement('div');
      while (agentsLog.firstChild) stash.appendChild(agentsLog.firstChild);
      _agentLogStash.set(prevAgentId, stash);
    }

    selectedAgentId = agent.id;
    _lastAgentResult = null;

    // Common UI setup
    agentsList.querySelectorAll('.agents-list-item').forEach((li) => {
      li.classList.toggle('active', li.dataset.agentId === agent.id);
    });
    agentsEmptyState.classList.add('hidden');
    agentsWorkspacePanel.classList.remove('hidden');
    agentPanelName.textContent = agent.name;
    agentPanelDescription.textContent = agent.description;
    document.querySelectorAll('[id^="agent-params-"]').forEach((el) => el.classList.add('hidden'));
    // Unmount any previously active Tier-2 cloud UI so it doesn't leak into
    // the next agent's pane.
    if (agentUiHost) {
      const prevCloudId = agentUiHost.dataset.cloudAgentMounted;
      if (prevCloudId && window.__agentUiHost?.unmount) {
        window.__agentUiHost.unmount(prevCloudId).catch(() => {});
        delete agentUiHost.dataset.cloudAgentMounted;
      }
    }
    const isCloudAgent = agent.manifest?.execution === 'cloud';
    const tier2Ui = agent.manifest?.entry?.ui || {};
    const isCloudTier2 = isCloudAgent && !!tier2Ui.html && !!tier2Ui.js;
    const bespokeParamBlock = agentHasBespokeUi(agent.id)
      ? document.getElementById(`agent-params-${agent.id}`)
      : null;
    if (bespokeParamBlock && !isCloudAgent) {
      bespokeParamBlock.classList.remove('hidden');
      if (btnAgentRun) btnAgentRun.classList.remove('hidden');
    } else if (isCloudTier2) {
      // Tier-2 cloud agents own their pre-run panel (question input,
      // past-sessions, picker). Hide the generic auto-form + top Run button.
      if (agentParamsAuto) agentParamsAuto.classList.add('hidden');
      if (btnAgentRun) btnAgentRun.classList.add('hidden');
    } else if (agentParamsAuto) {
      // Tier-0 cloud agents and plain Tier-0 agents use the auto-form.
      renderAutoForm(agentParamsAuto, agent.manifest);
      agentParamsAuto.classList.remove('hidden');
      if (btnAgentRun) btnAgentRun.classList.remove('hidden');
    }

    // Tier-2 cloud agents render their own workspace chrome (title, status,
    // actions, conversation area). Hide the shell's duplicates when mounting
    // one, and restore them for every other agent type.
    const shellHeader = agentsWorkspacePanel.querySelector('.agents-workspace-header');
    const shellActions = agentsWorkspacePanel.querySelector('.agents-actions');
    const shellLogHeader = agentsWorkspacePanel.querySelector('.agents-log-header');
    const shellLog = document.getElementById('agents-log');
    if (isCloudTier2) {
      shellHeader?.classList.add('hidden');
      shellActions?.classList.add('hidden');
      shellLogHeader?.classList.add('hidden');
      shellLog?.classList.add('hidden');
    } else {
      shellHeader?.classList.remove('hidden');
      shellActions?.classList.remove('hidden');
      shellLogHeader?.classList.remove('hidden');
      shellLog?.classList.remove('hidden');
    }

    // Mount the Tier-2 cloud-agent UI immediately in idle state so its own
    // pre-run panel (question + "Talked before?" past-sessions + picker) is
    // available before the user has typed anything.
    if (isCloudTier2 && agentUiHost) {
      agentUiHost.classList.remove('hidden');
      agentUiHost.innerHTML = '';
      window.__agentUiHost.mount(
        agent.id,
        agent.manifest,
        agentUiHost,
        { params: {} },
        `agents/${agent.id}`,
      ).then(() => {
        agentUiHost.dataset.cloudAgentMounted = agent.id;
      }).catch((err) => {
        console.warn('selectAgent: idle-mount failed', err);
      });
    }

    // Restore persisted run state
    const savedState = _agentRunState.get(agent.id);
    if (savedState && savedState.status !== 'idle') {
      setAgentStatus(savedState.status);
      _lastAgentResult = savedState.result || null;
    } else {
      setAgentStatus('idle');
    }

    // Clear and set log identity
    agentsLog.innerHTML = '';
    agentsLog.dataset.agent = agent.id;
    agentsOutputHeader.classList.add('hidden');
    agentsOutput.classList.add('hidden');
    if (btnAgentOpenInPages) btnAgentOpenInPages.classList.add('hidden');
    agentsSshWarning.classList.add('hidden');
    agentsLlmWarning.classList.add('hidden');

    // Restore stashed log content (any agent)
    const stashedLog = _agentLogStash.get(agent.id);
    if (stashedLog) {
      while (stashedLog.firstChild) agentsLog.appendChild(stashedLog.firstChild);
      _agentLogStash.delete(agent.id);
      agentsLog.scrollTop = agentsLog.scrollHeight;
    }

    // Restore output area for agents that completed in the background
    if (savedState && savedState.result) {
      const outputText =
        savedState.result.mindmapMarkdown ||
        savedState.result.summaryText ||
        savedState.result.markdown ||
        savedState.result.text ||
        '';
      if (outputText) {
        renderAgentOutput(agent.id, savedState.result);
        agentsOutputHeader.classList.remove('hidden');
        agentsOutput.classList.remove('hidden');
      }
      if (btnAgentOpenInPages) {
        btnAgentOpenInPages.classList.toggle('hidden', !savedState.result.mindmapPath);
      }
    }

    // MindMap: check if index.md already exists for quick-view
    const btnViewExisting = document.getElementById('btn-mindmap-view-existing');
    if (btnViewExisting) btnViewExisting.classList.add('hidden');
    if (agent.id === 'mindmap' && btnViewExisting && window.electronAPI?.webdavStat) {
      window.electronAPI.loadSettings().then(async (s) => {
        if (!s?.webdav?.url) return;
        const mmSettings = getMindmapSettings(s);
        const indexPath = joinWebdavPath(mmSettings.outputDir, 'index.md');
        try {
          const result = await window.electronAPI.webdavStat({ remotePath: indexPath });
          if (result.success && result.exists) {
            btnViewExisting.classList.remove('hidden');
            btnViewExisting._indexPath = indexPath;
            btnViewExisting._pagesRoot = ensureWebdavDirectoryPath(mmSettings.scanRoot || '/');
          }
        } catch (_) { /* silently fail */ }
      });
    }
  }

  async function openMindmapResultInPages(result, { notify = false } = {}) {
    if (!result?.mindmapPath) return false;

    if (currentMode !== 'pages') switchMode('pages');
    if (!_pagesInitialized) await pagesInit();
    const ok = await pagesNavigate(result.mindmapPath, true, { type: 'file' });
    if (ok && notify) showToast('Opened Mind Map in Pages', 'success');
    return ok;
  }

  // ── Status badge ──

  function setAgentStatus(status) {
    agentStatusBadge.textContent = status;
    agentStatusBadge.className = `agent-status-badge status-${status}`;
    const running = status === 'running';
    btnAgentRun.classList.toggle('hidden', running);
    btnAgentCancel.classList.toggle('hidden', !running);
  }

  // ── Output rendering (markdown vs plain) ──

  async function navigateToWebdavFile(href) {
    if (currentMode !== 'pages') switchMode('pages');
    if (!_pagesInitialized) await pagesInit();
    await pagesNavigate(href, true, { type: 'file' });
  }

  function renderAgentOutput(agentId, result) {
    const text = typeof result === 'string'
      ? result
      : (result?.markdown || result?.text || '');
    const saveSuggestion = typeof result === 'object' && result ? result.saveSuggestion : null;
    const hasMarkdown = typeof result === 'object' && result && typeof result.markdown === 'string';

    agentsOutputContent.innerHTML = '';

    // Tier-2 agents may export renderOutput(host, data) from ui.js to take
    // over output rendering. If the agent handles it, we're done — otherwise
    // fall back to the default markdown / plain-text path below.
    let handled = false;
    if (typeof result === 'object' && result && window.__agentUiHost?.renderOutput) {
      try {
        handled = window.__agentUiHost.renderOutput(agentId, agentsOutputContent, result) === true;
      } catch (err) {
        console.error('renderAgentOutput: custom renderer failed', err);
        handled = false;
      }
    }

    if (!handled) {
      const body = document.createElement('div');
      if (agentId === 'llm-wiki' || hasMarkdown) {
        try {
          body.innerHTML = marked.parse(text);
        } catch {
          body.textContent = text;
        }
      } else {
        body.textContent = text;
      }
      agentsOutputContent.appendChild(body);
    }

    if (saveSuggestion?.path && typeof saveSuggestion.content === 'string') {
      const actions = document.createElement('div');
      actions.className = 'agent-save-actions';
      actions.style.marginTop = '12px';
      const btn = document.createElement('button');
      btn.className = 'btn-small';
      btn.textContent = saveSuggestion.label || `Save to ${saveSuggestion.path}`;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          const res = await window.electronAPI.webdavWriteFile({
            remotePath: saveSuggestion.path,
            content: saveSuggestion.content,
          });
          if (!res?.success) throw new Error(res?.error || 'Write failed');
          const savedLine = document.createElement('div');
          savedLine.className = 'agent-saved-line';
          savedLine.style.marginTop = '4px';
          savedLine.appendChild(document.createTextNode('Saved to '));
          const link = document.createElement('a');
          link.href = saveSuggestion.path;
          link.textContent = saveSuggestion.path;
          link.addEventListener('click', async (ev) => {
            ev.preventDefault();
            try {
              await navigateToWebdavFile(saveSuggestion.path);
            } catch (err) {
              appendAgentLog(err.message || 'Failed to open saved file.', 'error');
            }
          });
          savedLine.appendChild(link);
          savedLine.appendChild(document.createTextNode('.'));
          actions.replaceWith(savedLine);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = saveSuggestion.label || `Save to ${saveSuggestion.path}`;
          appendAgentLog(`Save failed: ${err.message || err}`, 'error');
        }
      });
      actions.appendChild(btn);
      agentsOutputContent.appendChild(actions);
    }
  }

  // Intercept link clicks in the llm-wiki output — route WebDAV paths to Pages.
  if (agentsOutputContent) {
    agentsOutputContent.addEventListener('click', async (ev) => {
      if (selectedAgentId !== 'llm-wiki') return;
      const anchor = ev.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/')) return; // external URL — let it navigate
      ev.preventDefault();
      try {
        await navigateToWebdavFile(href);
      } catch (err) {
        appendAgentLog(err.message || 'Failed to open page.', 'error');
      }
    });
  }

  // ── Activity log ──

  function appendAgentLog(message, level = 'info', target = agentsLog) {
    const entry = document.createElement('div');
    entry.className = `agents-log-entry level-${level}`;
    const ts = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    entry.innerHTML = `<span class="agents-log-ts">${ts}</span><span class="agents-log-msg">${escapeHtml(message)}</span>`;
    target.appendChild(entry);
    if (target === agentsLog) {
      agentsLog.scrollTop = agentsLog.scrollHeight;
    }
  }

  // ── Per-agent log targets ──

  function getAgentLogTarget(agentId) {
    if (agentId === selectedAgentId && agentsLog.dataset.agent === agentId) return agentsLog;
    // Agent is not visible — use the stashed container
    if (!_agentLogStash.has(agentId)) _agentLogStash.set(agentId, document.createElement('div'));
    return _agentLogStash.get(agentId);
  }

  // ── Progress event subscription ──

  if (window.electronAPI?.onAgentProgress) {
    window.electronAPI.onAgentProgress((data) => {
      const eventAgentId = data.agentId;
      const isSelectedAgent = eventAgentId === selectedAgentId;

      if (data.type === 'progress') {
        // Append log to visible agentsLog or to stash
        const logTarget = getAgentLogTarget(eventAgentId);
        appendAgentLog(data.message, data.level || 'info', logTarget);
      } else if (data.type === 'error') {
        _agentRunState.set(eventAgentId, { status: 'error', result: null });
        const logTarget = getAgentLogTarget(eventAgentId);
        appendAgentLog(data.message || 'Unknown error', 'error', logTarget);
        if (isSelectedAgent) {
          setAgentStatus('error');
        }
      } else if (data.type === 'done') {
        // Always update per-agent state
        const doneStatus = data.cancelled ? 'cancelled' : data.error ? 'error' : 'done';
        _agentRunState.set(eventAgentId, { status: doneStatus, result: data.result || null });

        if (isSelectedAgent) {
          if (data.cancelled) {
            setAgentStatus('cancelled');
            appendAgentLog('Agent cancelled.', 'info');
          } else if (data.error) {
            setAgentStatus('error');
            appendAgentLog(`Error: ${data.error}`, 'error');
          } else {
            setAgentStatus('done');
            _lastAgentResult = data.result || null;
            const outputText =
              data.result?.mindmapMarkdown ||
              data.result?.summaryText ||
              data.result?.markdown ||
              data.result?.text ||
              '';
            if (outputText) {
              renderAgentOutput(eventAgentId, data.result);
              agentsOutputHeader.classList.remove('hidden');
              agentsOutput.classList.remove('hidden');
            }
            if (btnAgentOpenInPages) {
              btnAgentOpenInPages.classList.toggle('hidden', !data.result?.mindmapPath);
            }
          }
        } else {
          // Agent finished in background — stash done/error/cancel message
          const logTarget = getAgentLogTarget(eventAgentId);
          if (data.cancelled) {
            appendAgentLog('Agent cancelled.', 'info', logTarget);
          } else if (data.error) {
            appendAgentLog('Error: ' + data.error, 'error', logTarget);
          }
        }
      }
    });
  }

  // Explicit reload: main process re-scanned agents. Refresh the sidebar and,
  // if the settings modal is open, rebuild the Agents rail too.
  if (window.electronAPI?.onAgentListChanged) {
    window.electronAPI.onAgentListChanged(async () => {
      initAgentsList();
      if (!settingsModal.classList.contains('hidden') && window.electronAPI.listAgents) {
        try {
          buildAgentSettingsRail(await window.electronAPI.listAgents());
          _loadLlmFormFromSelection();
        } catch { /* ignore */ }
      }
    });
  }

  // ── LLM Wiki: tab switching + param collection ──

  function getActiveLlmWikiTab() {
    const tab = document.querySelector('#agent-params-llm-wiki .llm-wiki-tab.active');
    return tab?.dataset?.op || 'ingest';
  }

  function activateLlmWikiTab(op) {
    const root = document.getElementById('agent-params-llm-wiki');
    if (!root) return;
    root.querySelectorAll('.llm-wiki-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.op === op);
    });
    root.querySelectorAll('.llm-wiki-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.panel === op);
    });
  }

  function collectLlmWikiParams() {
    const op = getActiveLlmWikiTab();
    const params = { op };
    if (op === 'ingest') {
      const source = document.querySelector('#agent-params-llm-wiki input[name="llm-wiki-source"]:checked')?.value || 'pages';
      if (source === 'pages') {
        if (!_pagesCurrentFilePath) {
          return { error: 'No Pages file is open. Switch to Pages and open a file first, or choose URL / WebDAV path.' };
        }
        params.sourceKind = 'webdavPath';
        params.sourcePath = _pagesCurrentFilePath;
      } else if (source === 'url') {
        const url = document.getElementById('llm-wiki-url')?.value?.trim() || '';
        if (!url) return { error: 'Enter a URL to ingest.' };
        params.sourceKind = 'url';
        params.sourceUrl = url;
      } else {
        const p = document.getElementById('llm-wiki-webdav-path')?.value?.trim() || '';
        if (!p) return { error: 'Enter a WebDAV path to ingest.' };
        params.sourceKind = 'webdavPath';
        params.sourcePath = p.startsWith('/') ? p : `/${p}`;
      }
    } else if (op === 'query') {
      const q = document.getElementById('llm-wiki-question')?.value?.trim() || '';
      if (!q) return { error: 'Enter a question.' };
      params.question = q;
      params.fileAnswers = Boolean(document.getElementById('llm-wiki-file-answer')?.checked);
    }
    return { params };
  }

  // Delegate tab click once (fragment is in DOM from initAgentsList).
  if (agentUiHost) {
    agentUiHost.addEventListener('click', (ev) => {
      const tab = ev.target.closest('#agent-params-llm-wiki .llm-wiki-tab');
      if (!tab) return;
      activateLlmWikiTab(tab.dataset.op);
    });
  }

  // ── Run ──

  btnAgentRun.addEventListener('click', async () => {
    if (!selectedAgentId || !window.electronAPI) return;

    agentsSshWarning.classList.add('hidden');
    agentsLlmWarning.classList.add('hidden');
    _agentRunState.set(selectedAgentId, { status: 'running', result: null });
    setAgentStatus('running');
    appendAgentLog('Starting agent…');

    let instructions = '';
    const params = {};
    if (selectedAgentId === 'mindmap') {
      const guidanceEl = document.getElementById('mindmap-instructions');
      instructions = guidanceEl?.value?.trim() || '';
    } else if (selectedAgentId === 'llm-wiki') {
      const wikiParams = collectLlmWikiParams();
      if (wikiParams.error) {
        _agentRunState.set(selectedAgentId, { status: 'error', result: null });
        setAgentStatus('error');
        appendAgentLog(wikiParams.error, 'error');
        return;
      }
      Object.assign(params, wikiParams.params);
    } else if (agentParamsAuto) {
      Object.assign(params, collectAutoFormParams(agentParamsAuto));
    }
    params.instructions = instructions;

    // Cloud-agent execution path: Tier-2 UI owns the pane and drives the
    // cloud-agent IPC itself. Auto-form collected params feed in via the
    // agent's mount() params.
    const manifest = _agentManifestById.get(selectedAgentId);
    if (manifest?.execution === 'cloud') {
      const ui = manifest?.entry?.ui || {};
      if (!ui.js || !ui.html) {
        _agentRunState.set(selectedAgentId, { status: 'error', result: null });
        setAgentStatus('error');
        appendAgentLog(`Cloud agent "${selectedAgentId}" is missing entry.ui.html/ui.js`, 'error');
        return;
      }
      // Hide the auto-form and log area; the Tier-2 UI takes over.
      if (agentParamsAuto) agentParamsAuto.classList.add('hidden');
      if (agentUiHost) {
        agentUiHost.classList.remove('hidden');
        agentUiHost.innerHTML = '';
      }
      try {
        await window.__agentUiHost.mount(
          selectedAgentId,
          manifest,
          agentUiHost,
          { params },                       // api shim receives params; ui.js falls back to window.electronAPI
          `agents/${selectedAgentId}`,
        );
        agentUiHost.dataset.cloudAgentMounted = selectedAgentId;
      } catch (err) {
        _agentRunState.set(selectedAgentId, { status: 'error', result: null });
        setAgentStatus('error');
        appendAgentLog(err?.message || String(err), 'error');
      }
      return;
    }

    const result = await window.electronAPI.runAgent({ agentId: selectedAgentId, params });

    if (!result.success) {
      _agentRunState.set(selectedAgentId, { status: 'error', result: null });
      setAgentStatus('error');
      if (result.unconfigured === 'webdav' || result.unconfigured === 'ssh') {
        agentsSshWarning.classList.remove('hidden');
      } else if (result.unconfigured === 'llm') {
        agentsLlmWarning.classList.remove('hidden');
      }
      appendAgentLog(result.error || 'Failed to start agent.', 'error');
    }
    // On success the status updates arrive via onAgentProgress events
  });

  // ── Cancel ──

  btnAgentCancel.addEventListener('click', async () => {
    if (!selectedAgentId || !window.electronAPI) return;
    await window.electronAPI.cancelAgent({ agentId: selectedAgentId });
    appendAgentLog('Cancellation requested…');
  });

  // ── MindMap view existing ──
  // Button lives inside the MindMap params fragment, injected at startup by
  // initAgentsList → injectAgentUi. Delegate the click from #agent-ui-host so
  // we don't have to wait for the fragment to be available.

  if (agentUiHost) {
    agentUiHost.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('#btn-mindmap-view-existing');
      if (!btn) return;
      const indexPath = btn._indexPath;
      const pagesRoot = btn._pagesRoot;
      if (!indexPath) return;
      const opened = await openMindmapResultInPages(
        { mindmapPath: indexPath, pagesRoot },
        { notify: true }
      );
      if (!opened) showToast('Could not open the Mind Map index page.', 'error');
    });
  }

  // ── Clear log ──

  btnAgentClearLog.addEventListener('click', () => {
    agentsLog.innerHTML = '';
  });

  // ── Copy output ──

  btnAgentCopyOutput.addEventListener('click', () => {
    navigator.clipboard.writeText(agentsOutputContent.textContent).then(() => {
      showToast('Output copied to clipboard', 'success');
    });
  });

  if (btnAgentOpenInPages) {
    btnAgentOpenInPages.addEventListener('click', async () => {
      const remotePath = _lastAgentResult?.mindmapPath;
      if (!remotePath) return;
      const opened = await openMindmapResultInPages(
        { mindmapPath: remotePath, pagesRoot: _lastAgentResult?.pagesRoot },
        { notify: true }
      );
      if (!opened) showToast('Could not open the page', 'error');
    });
  }

  // ── Open in Markdown Editor ──

  btnAgentOpenInEditor.addEventListener('click', async () => {
    const content = agentsOutputContent.textContent;
    if (!content) return;
    mdEditorNewTab(null, content);
    switchMode('editor');
    switchEditorSubMode('md-editor');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Terminal Mode (multi-tab)
  // ══════════════════════════════════════════════════════════════════════════

  let _termTabs = [];
  let _activeTermTabId = null;
  let _termTabCounter = 0;
  let _termInitialized = false;

  // Called by applyFontSettings() to propagate font changes to existing terminals.
  // xterm.js snapshots font at creation; this updates them post-hoc.
  function updateTerminalFonts() {
    if (!_termTabs.length) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const family = rootStyle.getPropertyValue('--font-mono').trim() || DEFAULT_FONT_MONO;
    const size = parseInt(rootStyle.getPropertyValue('--font-size-mono'), 10) || 14;
    for (const tab of _termTabs) {
      if (!tab.terminal) continue;
      tab.terminal.options.fontFamily = family;
      tab.terminal.options.fontSize = size;
      tab.fitAddon.fit();
    }
  }

  function handleTerminalKeyEvent(e) {
    if (e.type !== 'keydown') return true;
    // Terminal shortcuts (Cmd/Ctrl+Shift+T/W, Cmd/Ctrl+PageUp/Down) are handled
    // by the document-level capture listener in initTerminal(). Returning false
    // here just prevents xterm from processing these keys (avoids double-firing).
    if (e[MOD_KEY_EVENT] && e.shiftKey && (e.code === 'KeyT' || e.code === 'KeyW')) return false;
    if (e[MOD_KEY_EVENT] && (e.code === 'PageDown' || e.code === 'PageUp')) return false;
    // Cmd/Ctrl+F: open find bar instead of sending ^F to the PTY
    if (e[MOD_KEY_EVENT] && !e.shiftKey && !e.altKey && e.code === 'KeyF') {
      e.preventDefault();
      openFindBar();
      return false;
    }
    // Cmd/Ctrl+Shift+C: copy selection to clipboard
    if (e[MOD_KEY_EVENT] && e.shiftKey && e.code === 'KeyC') {
      const tab = _termTabs.find((t) => t.id === _activeTermTabId);
      if (tab && tab.terminal) {
        const sel = tab.terminal.getSelection();
        if (sel) navigator.clipboard.writeText(sel);
      }
      return false;
    }
    // Cmd/Ctrl+Shift+V: paste from clipboard into terminal. Prefer an image
    // on the clipboard (save to tmp, paste the path) and fall back to text.
    if (e[MOD_KEY_EVENT] && e.shiftKey && e.code === 'KeyV') {
      e.preventDefault();
      const tab = _termTabs.find((t) => t.id === _activeTermTabId);
      if (tab && tab.terminal) pasteClipboardIntoTerminal(tab);
      return false;
    }
    return true;
  }

  // Paste the active clipboard contents into a terminal tab. If the clipboard
  // holds an image (e.g. a screenshot), write it to a tmp PNG via the main
  // process and paste the file path — this is the contract Claude Code and
  // similar TUIs use to attach images from the host clipboard.
  async function pasteClipboardIntoTerminal(tab) {
    try {
      const res = await window.electronAPI.terminalSaveClipboardImage();
      if (res && res.success && res.path) {
        tab.terminal.paste(res.path);
        return;
      }
    } catch (_) { /* fall through to text */ }
    try {
      const text = await navigator.clipboard.readText();
      if (text) tab.terminal.paste(text);
    } catch (_) { /* nothing on clipboard */ }
  }

  function switchTermTabRelative(delta) {
    if (_termTabs.length <= 1) return;
    const idx = _termTabs.findIndex((t) => t.id === _activeTermTabId);
    const newIdx = (idx + delta + _termTabs.length) % _termTabs.length;
    activateTermTab(_termTabs[newIdx].id);
  }

  function renderTerminalSidebar() {
    terminalTabList.innerHTML = '';
    _termTabs.forEach((tab) => {
      const item = document.createElement('div');
      item.className = 'terminal-tab-item' + (tab.id === _activeTermTabId ? ' active' : '');

      const labelSpan = document.createElement('span');
      labelSpan.className = 'terminal-tab-item-label';
      labelSpan.textContent = tab.label;

      labelSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startRenameTermTab(tab, labelSpan);
      });

      const closeBtn = document.createElement('span');
      closeBtn.className = 'terminal-tab-item-close';
      closeBtn.textContent = '\u00d7';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTermTab(tab.id);
      });

      item.appendChild(labelSpan);
      item.appendChild(closeBtn);

      item.addEventListener('click', () => {
        if (tab.id !== _activeTermTabId) activateTermTab(tab.id);
      });

      terminalTabList.appendChild(item);
    });
  }

  function startRenameTermTab(tab, labelSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-tab-rename-input';
    input.value = tab.label;

    function commitRename() {
      const newLabel = input.value.trim();
      if (newLabel && newLabel !== tab.label) {
        tab.label = newLabel;
        if (tab.shelfLabelEl) tab.shelfLabelEl.textContent = newLabel;
      }
      renderTerminalSidebar();
    }

    input.addEventListener('blur', commitRename);
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
      else if (ke.key === 'Escape') { input.removeEventListener('blur', commitRename); renderTerminalSidebar(); }
    });
    input.addEventListener('click', (ce) => ce.stopPropagation());

    labelSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  function activateTermTab(tabId) {
    _activeTermTabId = tabId;
    _termTabs.forEach((t) => {
      t.containerEl.classList.toggle('active', t.id === tabId);
    });
    const tab = _termTabs.find((t) => t.id === tabId);
    if (tab) {
      if (tab.fitAddon) tab.fitAddon.fit();
      if (tab.terminal) tab.terminal.focus();
      btnTerminalRestart.classList.toggle('hidden', tab.spawned);
    }
    renderTerminalSidebar();
  }

  // Snapshot scrollback of an exited terminal into a static <pre>, then
  // dispose the xterm. Preserves the final output the user wants to read
  // while freeing the OffscreenCanvas atlas (a /dev/shm fd on Linux).
  function _freezeExitedTerminal(tab, exitCode) {
    if (!tab.terminal) return;
    let lines = [];
    try {
      const buf = tab.terminal.buffer.active;
      const len = buf.length;
      const start = Math.max(0, len - 2000);
      for (let i = start; i < len; i++) {
        const line = buf.getLine(i);
        if (line) lines.push(line.translateToString(true));
      }
    } catch (_) {}
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const text = lines.join('\n');

    if (tab.searchListener) { try { tab.searchListener.dispose(); } catch (_) {} tab.searchListener = null; }
    tab.searchAddon = null;
    try { tab.terminal.dispose(); } catch (_) {}
    tab.terminal = null;

    const shellEl = tab.containerEl && tab.containerEl.querySelector('.terminal-shell');
    if (shellEl) {
      shellEl.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'terminal-exited-snapshot';
      pre.textContent = text + '\n\n--- Process exited (code ' + exitCode + ') ---\n';
      shellEl.appendChild(pre);
    }
  }

  async function closeTermTab(tabId) {
    const idx = _termTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const tab = _termTabs[idx];

    if (tab.ptyId) await window.electronAPI.terminalKill(tab.ptyId);
    if (tab.searchListener) { try { tab.searchListener.dispose(); } catch (_) {} tab.searchListener = null; }
    tab.searchAddon = null;
    if (tab.terminal) { try { tab.terminal.dispose(); } catch (_) {} tab.terminal = null; }
    tab.containerEl.remove();
    _termTabs.splice(idx, 1);

    if (_activeTermTabId === tabId) {
      if (_termTabs.length === 0) {
        _termTabCounter = 0;
        await createTermTab();
      } else {
        const newIdx = Math.min(idx, _termTabs.length - 1);
        activateTermTab(_termTabs[newIdx].id);
      }
    } else {
      renderTerminalSidebar();
    }
  }

  async function spawnTermTabPty(tab) {
    const result = await window.electronAPI.terminalSpawn();
    if (result.success) {
      tab.ptyId = result.ptyId;
      tab.spawned = true;
      if (tab.containerEl) tab.containerEl.classList.remove('is-disconnected');
      if (tab.id === _activeTermTabId) btnTerminalRestart.classList.add('hidden');
      const dims = tab.fitAddon && tab.fitAddon.proposeDimensions();
      if (dims && dims.cols > 0 && dims.rows > 0) window.electronAPI.terminalResize(tab.ptyId, dims.cols, dims.rows);
    } else {
      if (tab.terminal) tab.terminal.write(`\r\n\x1b[31mFailed to start shell: ${result.error}\x1b[0m\r\n`);
      if (tab.id === _activeTermTabId) btnTerminalRestart.classList.remove('hidden');
    }
  }

  // Build a fresh xterm + addons inside shellEl and wire it to the given tab.
  // Used by createTermTab() for new tabs and by the Restart button to rebuild
  // after _freezeExitedTerminal() disposed the previous xterm.
  function _mountTerminal(tab, shellEl) {
    const rootStyle = getComputedStyle(document.documentElement);
    const termFontMono = rootStyle.getPropertyValue('--font-mono').trim() || "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
    const termFontSize = parseInt(rootStyle.getPropertyValue('--font-size-mono'), 10) || 14;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: termFontSize,
      fontFamily: termFontMono,
      scrollback: 10000,
      // SearchAddon uses registerDecoration (proposed API) for match highlights.
      allowProposedApi: true,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: 'rgba(56, 139, 253, 0.3)',
      },
    });
    const fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon.WebLinksAddon((event, uri) => {
      window.electronAPI.openExternal(uri);
    }));
    terminal.open(shellEl);
    // xterm's built-in paste handler (bubble-phase, on both the helper
    // textarea and the .xterm element) reads only text/plain, so image
    // clipboard data — screenshots destined for Claude Code and similar
    // TUIs — is otherwise dropped. Capture-phase listener on the parent
    // intercepts before xterm sees the event: on image pastes, swallow the
    // event and route through our tmp-file path; on text pastes, no-op.
    shellEl.addEventListener('paste', (ev) => {
      const items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      let hasImage = false;
      for (const item of items) {
        if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
          hasImage = true;
          break;
        }
      }
      if (!hasImage) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      pasteClipboardIntoTerminal(tab);
    }, true);
    terminal.onData((data) => {
      if (tab.spawned && tab.ptyId) window.electronAPI.terminalSendData(tab.ptyId, data);
    });
    terminal.onResize(({ cols, rows }) => {
      if (tab.spawned && tab.ptyId && cols > 0 && rows > 0) window.electronAPI.terminalResize(tab.ptyId, cols, rows);
    });
    terminal.attachCustomKeyEventHandler(handleTerminalKeyEvent);
    const searchAddon = new SearchAddon.SearchAddon();
    terminal.loadAddon(searchAddon);
    // Forward result counts to the find bar when this tab is the active one.
    const searchListener = searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
      if (!findBarVisible) return;
      if (currentMode !== 'terminal' || _activeTermTabId !== tab.id) return;
      customFindMatchCount = resultCount || 0;
      customFindCurrentIndex = resultIndex >= 0 ? resultIndex : 0;
      updateFindMatchCountDisplay();
    });
    tab.terminal = terminal;
    tab.fitAddon = fitAddon;
    tab.searchAddon = searchAddon;
    tab.searchListener = searchListener;
  }

  async function createTermTab() {
    _termTabCounter++;
    const tabId = 'term-' + _termTabCounter;
    const label = 'Terminal ' + _termTabCounter;

    const containerEl = document.createElement('div');
    containerEl.className = 'terminal-tab-container';
    terminalMain.appendChild(containerEl);

    const shellEl = document.createElement('div');
    shellEl.className = 'terminal-shell';
    containerEl.appendChild(shellEl);

    const shelfEl = document.createElement('div');
    shelfEl.className = 'terminal-shelf';
    const shelfDot = document.createElement('span');
    shelfDot.className = 'terminal-shelf-dot';
    const shelfBracketL = document.createElement('span');
    shelfBracketL.className = 'terminal-shelf-bracket';
    shelfBracketL.textContent = '⟦';
    const shelfLabelEl = document.createElement('span');
    shelfLabelEl.className = 'terminal-shelf-label';
    shelfLabelEl.textContent = label;
    const shelfBracketR = document.createElement('span');
    shelfBracketR.className = 'terminal-shelf-bracket';
    shelfBracketR.textContent = '⟧';
    const shelfSep = document.createElement('span');
    shelfSep.className = 'terminal-shelf-sep';
    const shelfHint = document.createElement('span');
    shelfHint.className = 'terminal-shelf-hint';
    shelfHint.textContent = IS_MAC
      ? 'cmd+shift+t  new · cmd+shift+w  close · dblclick  rename'
      : 'ctrl-shift-t  new · ctrl-shift-w  close · dblclick  rename';
    shelfEl.append(shelfDot, shelfBracketL, shelfLabelEl, shelfBracketR, shelfSep, shelfHint);
    containerEl.appendChild(shelfEl);

    const tab = { id: tabId, label, terminal: null, fitAddon: null, searchAddon: null, searchListener: null, spawned: false, containerEl, shelfLabelEl, ptyId: null };
    _mountTerminal(tab, shellEl);
    _termTabs.push(tab);

    activateTermTab(tabId);
    await spawnTermTabPty(tab);
  }

  async function initTerminal() {
    if (_termInitialized) {
      const tab = _termTabs.find((t) => t.id === _activeTermTabId);
      if (tab) {
        setTimeout(() => {
          if (tab.fitAddon) tab.fitAddon.fit();
          if (tab.terminal) tab.terminal.focus();
        }, 0);
      }
      return;
    }

    await ensureXterm();

    // Route PTY output to the correct tab. Chunks arrive via IPC at PTY rate;
    // bursty producers (e.g. `tmux attach` replaying scrollback) can emit
    // thousands of messages per second. Calling xterm's write() once per
    // message starves the renderer's main loop and can stall CDP / input
    // handling. Coalesce per-tab into one write per animation frame.
    const _pendingTerminalWrites = new Map(); // ptyId -> string[]
    let _terminalFlushScheduled = false;
    const flushTerminalWrites = () => {
      _terminalFlushScheduled = false;
      for (const [ptyId, chunks] of _pendingTerminalWrites) {
        if (!chunks.length) continue;
        const tab = _termTabs.find((t) => t.ptyId === ptyId);
        if (tab && tab.terminal) tab.terminal.write(chunks.join(''));
      }
      _pendingTerminalWrites.clear();
    };
    window.electronAPI.onTerminalData((ptyId, data) => {
      let queue = _pendingTerminalWrites.get(ptyId);
      if (!queue) { queue = []; _pendingTerminalWrites.set(ptyId, queue); }
      queue.push(data);
      if (!_terminalFlushScheduled) {
        _terminalFlushScheduled = true;
        requestAnimationFrame(flushTerminalWrites);
      }
    });

    // Handle PTY exit. xterm's OffscreenCanvas texture atlas is backed by a
    // /dev/shm fd; leaving exited terminals alive across hours accumulates
    // them until the renderer hits RLIMIT_NOFILE. Snapshot scrollback to a
    // plain <pre>, then dispose the xterm. The user can still read final
    // output, and Restart recreates a fresh terminal in place.
    window.electronAPI.onTerminalExit((ptyId, exitCode) => {
      const tab = _termTabs.find((t) => t.ptyId === ptyId);
      if (!tab) return;
      tab.spawned = false;
      tab.ptyId = null;
      _freezeExitedTerminal(tab, exitCode);
      if (tab.containerEl) tab.containerEl.classList.add('is-disconnected');
      if (tab.id === _activeTermTabId) btnTerminalRestart.classList.remove('hidden');
    });

    // Window resize — fit only the active tab
    window.addEventListener('resize', () => {
      if (currentMode === 'terminal' && _activeTermTabId) {
        const tab = _termTabs.find((t) => t.id === _activeTermTabId);
        if (tab && tab.fitAddon) tab.fitAddon.fit();
      }
    });

    // "+" button
    btnTerminalNewTab.addEventListener('click', () => createTermTab());

    // Global keyboard shortcuts (capture phase, for when terminal isn't focused)
    document.addEventListener('keydown', (e) => {
      if (currentMode !== 'terminal') return;
      if (e[MOD_KEY_EVENT] && e.shiftKey && e.code === 'KeyT') { e.preventDefault(); createTermTab(); }
      else if (e[MOD_KEY_EVENT] && e.shiftKey && e.code === 'KeyW') { e.preventDefault(); if (_activeTermTabId) closeTermTab(_activeTermTabId); }
      else if (e[MOD_KEY_EVENT] && e.code === 'PageDown') { e.preventDefault(); switchTermTabRelative(+1); }
      else if (e[MOD_KEY_EVENT] && e.code === 'PageUp') { e.preventDefault(); switchTermTabRelative(-1); }
    }, true);

    _termInitialized = true;
    await createTermTab();
  }

  btnTerminalRestart.addEventListener('click', async () => {
    const tab = _termTabs.find((t) => t.id === _activeTermTabId);
    if (!tab) return;
    // After PTY exit we dispose xterm and replace the shell with a static
    // <pre> snapshot; restart rebuilds a fresh xterm in place.
    if (!tab.terminal) {
      const shellEl = tab.containerEl && tab.containerEl.querySelector('.terminal-shell');
      if (!shellEl) return;
      shellEl.innerHTML = '';
      _mountTerminal(tab, shellEl);
      if (tab.containerEl) tab.containerEl.classList.remove('is-disconnected');
    } else {
      tab.terminal.clear();
    }
    await spawnTermTabPty(tab);
    if (tab.terminal) tab.terminal.focus();
  });

  // ════════════════════════════════════════════
  //  RSS Reader
  // ════════════════════════════════════════════

  // DOM refs — RSS view
  const rssSidebarEl = document.getElementById('rss-sidebar');
  const rssFeedListEl = document.getElementById('rss-feed-list');
  const rssCardGridEl = document.getElementById('rss-card-grid');
  const rssEmptyStateEl = document.getElementById('rss-empty-state');
  const rssMainTitleEl = document.getElementById('rss-main-title');
  const rssMainMetaEl = document.getElementById('rss-main-meta');
  const rssLastRefreshEl = document.getElementById('rss-last-refresh');
  const rssReaderOverlayEl = document.getElementById('rss-reader-overlay');
  const rssReaderContentEl = document.getElementById('rss-reader-content');
  const rssReaderStarBtn = document.getElementById('btn-rss-reader-star');
  const rssReaderOpenBtn = document.getElementById('btn-rss-reader-open');
  const rssReaderBackBtn = document.getElementById('btn-rss-reader-back');
  const rssReaderCaptionEl = document.getElementById('rss-reader-toolbar-caption');
  const rssReaderProgressBarEl = document.getElementById('rss-reader-progress-bar');
  const rssRefreshBtn = document.getElementById('btn-rss-refresh');
  const rssFilterPills = document.querySelectorAll('.rss-filter-pill');

  // DOM refs — RSS settings
  const rssFeedsTableEl = document.getElementById('rss-feeds-table');
  const rssFeedNewUrlEl = document.getElementById('rss-feed-new-url');
  const rssFeedNewTitleEl = document.getElementById('rss-feed-new-title');
  const rssFeedAddBtn = document.getElementById('btn-rss-feed-add');
  const rssOpmlImportBtn = document.getElementById('btn-rss-opml-import');
  const rssOpmlExportBtn = document.getElementById('btn-rss-opml-export');
  const rssOpmlStatusEl = document.getElementById('rss-opml-status');
  const rssRefreshIntervalEl = document.getElementById('rss-refresh-interval');
  const rssBackgroundRefreshEl = document.getElementById('rss-background-refresh');
  const rssOutputDirEl = document.getElementById('rss-output-dir');
  const rssSyncEnabledEl = document.getElementById('rss-sync-enabled');

  const RSS_CACHE_KEY = 'mad-rss-cache-v1';
  const RSS_MAX_ARTICLES_PER_FEED = 200;

  let _rssState = null;
  let _rssInitialized = false;
  let _rssRefreshTimer = null;
  let _rssSyncDebounceTimer = null;
  let _rssSettings = { refreshIntervalMinutes: 30, backgroundRefresh: true, outputDir: '/rss', syncEnabled: true };

  // ── SMART-RSS state ──────────────────────────────────────────────
  let _smartInterests = [];           // [{ id, name }]
  let _smartSortActive = false;
  let _smartScores = Object.create(null); // guid → score
  const SMART_LAST_PROMOTE_KEY = 'mad-smart-rss-last-promote';

  async function smartCall(fn, ...args) {
    try {
      return await window.electronAPI?.rssSmart?.[fn]?.(...args);
    } catch (err) {
      console.warn('[smart-rss]', fn, 'failed', err);
      return null;
    }
  }

  async function smartRefreshInterests() {
    const res = await smartCall('listInterests');
    _smartInterests = res?.interests || [];
    smartRenderInterests();
  }

  function smartRenderInterests() {
    const listEl = document.getElementById('rss-interests-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    for (const it of _smartInterests) {
      const li = document.createElement('li');
      li.textContent = it.name;
      const btn = document.createElement('button');
      btn.className = 'interest-remove';
      btn.textContent = '×';
      btn.title = 'Remove';
      btn.addEventListener('click', async () => {
        await smartCall('removeInterest', it.id);
        await smartRefreshInterests();
        if (_smartSortActive) smartRescoreAndRerender();
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  function smartWireInterestForm() {
    const addBtn = document.getElementById('btn-rss-interest-add');
    const form = document.getElementById('rss-interests-form');
    const input = document.getElementById('rss-interest-input');
    if (!addBtn || !form || !input) return;
    addBtn.addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) input.focus();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      input.value = '';
      form.classList.add('hidden');
      await smartCall('addInterest', name);
      await smartRefreshInterests();
      if (_smartSortActive) smartRescoreAndRerender();
    });
  }

  function smartEmbedRecent() {
    if (!_rssState) return;
    const unembedded = _rssState.articles.filter((a) => a._smartEmbedded !== true).slice(-200);
    if (!unembedded.length) return;
    smartCall('embedArticles', unembedded.map((a) => ({
      guid: a.guid,
      feedId: a.feedId,
      title: a.title,
      summary: (a.excerpt || '').slice(0, 500),
      publishedAtMs: Number(a.publishedAt) || 0,
    }))).then((res) => {
      if (!res) return;
      for (const a of unembedded) a._smartEmbedded = true;
    });
  }

  function smartWireSortPill() {
    const pill = document.querySelector('[data-rss-sort="smart"]');
    if (!pill) return;
    pill.addEventListener('click', async () => {
      _smartSortActive = !_smartSortActive;
      pill.classList.toggle('active', _smartSortActive);
      if (_smartSortActive) await smartRescoreAndRerender();
      else rssRenderCards();
    });
  }

  async function smartRescoreAndRerender() {
    if (!_rssState) return;
    const guids = _rssState.articles.filter((a) => a._smartEmbedded).map((a) => a.guid);
    if (!guids.length) { rssRenderCards(); return; }
    const res = await smartCall('score', guids);
    _smartScores = res?.scores || Object.create(null);
    rssRenderCards();
  }

  async function smartMaybePromote() {
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(SMART_LAST_PROMOTE_KEY);
    if (last === today) return;
    const res = await smartCall('runPromote');
    if (res && typeof res.updated === 'number') {
      localStorage.setItem(SMART_LAST_PROMOTE_KEY, today);
    }
  }

  function rssCreateState() {
    return {
      feeds: [],       // { id, url, title, lastFetchedAt, errorMessage }
      articles: [],    // { guid, feedId, url, title, author, contentHtml, excerpt, imageUrl, publishedAt, read, starred }
      activeFeedId: null,
      filter: 'all',
      readingGuid: null,
    };
  }

  function rssLoadCache() {
    try {
      const raw = localStorage.getItem(RSS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.feeds) || !Array.isArray(parsed.articles)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function rssSaveCache() {
    if (!_rssState) return;
    try {
      const payload = {
        feeds: _rssState.feeds,
        articles: _rssState.articles.slice(-5000).map(({ _smartEmbedded, ...rest }) => rest),
      };
      localStorage.setItem(RSS_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* quota exceeded etc. — silently drop */
    }
  }

  function rssScheduleStateSync() {
    if (!_rssSettings.syncEnabled) return;
    if (_rssSyncDebounceTimer) clearTimeout(_rssSyncDebounceTimer);
    _rssSyncDebounceTimer = setTimeout(rssPushStateToWebdav, 2000);
  }

  async function rssPushStateToWebdav() {
    if (!_rssState || !_rssSettings.syncEnabled) return;
    if (!window.electronAPI?.rssSaveState) return;
    const payload = {
      version: 1,
      updatedAt: Date.now(),
      feeds: _rssState.feeds.map((f) => ({ id: f.id, url: f.url, title: f.title })),
      readGuids: _rssState.articles.filter((a) => a.read).map((a) => a.guid),
      starredGuids: _rssState.articles.filter((a) => a.starred).map((a) => a.guid),
    };
    try {
      await window.electronAPI.rssSaveState(JSON.stringify(payload));
    } catch (_) { /* silent */ }
  }

  async function rssPullStateFromWebdav() {
    if (!_rssSettings.syncEnabled || !window.electronAPI?.rssLoadState) return;
    try {
      const res = await window.electronAPI.rssLoadState();
      if (!res?.success) return;
      const remote = JSON.parse(res.stateJson);
      if (!remote || typeof remote !== 'object') return;
      // Merge feeds: remote wins for feeds not in local
      if (Array.isArray(remote.feeds)) {
        for (const rf of remote.feeds) {
          if (!_rssState.feeds.some((f) => f.url === rf.url)) {
            _rssState.feeds.push({ id: rf.id || crypto.randomUUID(), url: rf.url, title: rf.title || rf.url });
          }
        }
      }
      // Merge read/starred state
      const readSet = new Set(remote.readGuids || []);
      const starredSet = new Set(remote.starredGuids || []);
      for (const art of _rssState.articles) {
        if (readSet.has(art.guid)) art.read = true;
        if (starredSet.has(art.guid)) art.starred = true;
      }
    } catch (_) { /* silent */ }
  }

  function rssParseFeed(xmlText, feedUrl) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (doc.querySelector('parsererror')) {
      throw new Error('Feed is not valid XML');
    }
    const root = doc.documentElement;
    const tag = root.tagName.toLowerCase();
    const items = [];
    let feedTitle = '';
    if (tag === 'rss') {
      const channel = root.querySelector('channel');
      if (channel) feedTitle = channel.querySelector(':scope > title')?.textContent?.trim() || '';
      doc.querySelectorAll('item').forEach((node) => {
        const contentEncoded = node.getElementsByTagNameNS('*', 'encoded')[0]?.textContent || '';
        const description = node.querySelector('description')?.textContent || '';
        const html = contentEncoded || description || '';
        items.push({
          title: node.querySelector('title')?.textContent?.trim() || '(untitled)',
          link: node.querySelector('link')?.textContent?.trim() || '',
          guid: node.querySelector('guid')?.textContent?.trim() || '',
          pubDate: node.querySelector('pubDate')?.textContent?.trim() || '',
          author: node.querySelector('author')?.textContent?.trim()
            || node.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim()
            || '',
          html,
        });
      });
    } else if (tag === 'feed') {
      feedTitle = root.querySelector(':scope > title')?.textContent?.trim() || '';
      doc.querySelectorAll('entry').forEach((node) => {
        const contentEl = node.querySelector('content') || node.querySelector('summary');
        const html = contentEl?.textContent || '';
        const linkEl = node.querySelector('link[rel="alternate"], link:not([rel])') || node.querySelector('link');
        items.push({
          title: node.querySelector('title')?.textContent?.trim() || '(untitled)',
          link: linkEl?.getAttribute('href') || '',
          guid: node.querySelector('id')?.textContent?.trim() || '',
          pubDate: node.querySelector('published')?.textContent?.trim()
            || node.querySelector('updated')?.textContent?.trim() || '',
          author: node.querySelector('author > name')?.textContent?.trim() || '',
          html,
        });
      });
    } else if (tag === 'rdf:rdf' || tag.endsWith(':rdf') || tag === 'rdf') {
      feedTitle = doc.querySelector('channel > title')?.textContent?.trim() || '';
      doc.querySelectorAll('item').forEach((node) => {
        const html = node.getElementsByTagNameNS('*', 'encoded')[0]?.textContent
          || node.querySelector('description')?.textContent || '';
        items.push({
          title: node.querySelector('title')?.textContent?.trim() || '(untitled)',
          link: node.querySelector('link')?.textContent?.trim() || '',
          guid: node.getAttribute('rdf:about') || '',
          pubDate: node.getElementsByTagNameNS('*', 'date')[0]?.textContent?.trim() || '',
          author: node.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim() || '',
          html,
        });
      });
    } else {
      throw new Error(`Unrecognized feed format: <${tag}>`);
    }
    return { feedTitle, items, feedUrl };
  }

  function rssExtractImage(html) {
    if (!html) return '';
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }

  function rssStripTags(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').trim();
  }

  function rssSanitizeHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const bad = doc.querySelectorAll('script, style, iframe, object, embed, link, meta, form, input, button');
    bad.forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('on') || attr.name === 'srcdoc') {
          el.removeAttribute(attr.name);
        }
        if (attr.name === 'href' && /^javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return doc.body.firstChild?.innerHTML || '';
  }

  function rssMakeGuid(item, feedId) {
    return item.guid || item.link || `${feedId}:${item.title}:${item.pubDate}`;
  }

  function rssMergeItems(feed, items) {
    const existingByGuid = new Map(
      _rssState.articles.filter((a) => a.feedId === feed.id).map((a) => [a.guid, a])
    );
    for (const item of items) {
      const guid = rssMakeGuid(item, feed.id);
      const cleanHtml = rssSanitizeHtml(item.html);
      const excerpt = rssStripTags(item.html).slice(0, 220);
      const imageUrl = rssExtractImage(item.html);
      const publishedAt = item.pubDate ? Date.parse(item.pubDate) || Date.now() : Date.now();
      if (existingByGuid.has(guid)) {
        const existing = existingByGuid.get(guid);
        existing.title = item.title;
        existing.url = item.link || existing.url;
        existing.contentHtml = cleanHtml;
        existing.excerpt = excerpt;
        if (imageUrl) existing.imageUrl = imageUrl;
        if (item.author) existing.author = item.author;
      } else {
        _rssState.articles.push({
          guid,
          feedId: feed.id,
          url: item.link || '',
          title: item.title,
          author: item.author || '',
          contentHtml: cleanHtml,
          excerpt,
          imageUrl,
          publishedAt,
          read: false,
          starred: false,
        });
      }
    }
    // Cap per-feed: trim oldest read articles first
    const feedArticles = _rssState.articles.filter((a) => a.feedId === feed.id);
    if (feedArticles.length > RSS_MAX_ARTICLES_PER_FEED) {
      feedArticles.sort((a, b) => a.publishedAt - b.publishedAt);
      const removeCount = feedArticles.length - RSS_MAX_ARTICLES_PER_FEED;
      const toRemove = feedArticles.filter((a) => a.read && !a.starred).slice(0, removeCount);
      const removeGuids = new Set(toRemove.map((a) => a.guid));
      _rssState.articles = _rssState.articles.filter((a) => !removeGuids.has(a.guid));
    }
  }

  async function rssFetchOneFeed(feed) {
    if (!window.electronAPI?.rssFetchFeed) return { success: false, error: 'No RSS IPC' };
    try {
      const res = await window.electronAPI.rssFetchFeed(feed.url);
      if (!res.success) {
        feed.errorMessage = res.error;
        return res;
      }
      const parsed = rssParseFeed(res.xmlText, feed.url);
      if (!feed.title || feed.title === feed.url) feed.title = parsed.feedTitle || feed.url;
      rssMergeItems(feed, parsed.items);
      feed.lastFetchedAt = Date.now();
      feed.errorMessage = '';
      return { success: true, count: parsed.items.length };
    } catch (err) {
      feed.errorMessage = err.message || String(err);
      return { success: false, error: feed.errorMessage };
    }
  }

  let _rssRefreshing = false;
  async function rssRefreshAll({ render = true } = {}) {
    if (!_rssState) return;
    if (_rssRefreshing) return;
    _rssRefreshing = true;
    try {
      for (const feed of _rssState.feeds) {
        await rssFetchOneFeed(feed);
        if (render && currentMode === 'rss') rssRenderSidebar();
      }
      rssSaveCache();
      smartEmbedRecent();
      rssScheduleStateSync();
      if (render && currentMode === 'rss') {
        rssRenderCards();
      }
      if (rssLastRefreshEl) {
        rssLastRefreshEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
      }
    } finally {
      _rssRefreshing = false;
    }
  }

  function rssStartAutoRefresh() {
    if (_rssRefreshTimer) {
      clearInterval(_rssRefreshTimer);
      _rssRefreshTimer = null;
    }
    if (!_rssSettings.backgroundRefresh) return;
    const ms = Math.max(5, _rssSettings.refreshIntervalMinutes) * 60 * 1000;
    _rssRefreshTimer = setInterval(() => rssRefreshAll().catch(() => {}), ms);
  }

  function rssRelativeTime(ts) {
    if (!ts) return '';
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  function rssFilteredArticles() {
    let list = _rssState.articles.slice();
    if (_rssState.activeFeedId) {
      list = list.filter((a) => a.feedId === _rssState.activeFeedId);
    }
    if (_rssState.filter === 'unread') list = list.filter((a) => !a.read);
    else if (_rssState.filter === 'starred') list = list.filter((a) => a.starred);
    if (_smartSortActive) {
      list = list.filter((a) => {
        if (a.read || a.starred) return true;
        return _smartScores[a.guid] !== -Infinity;
      });
    }
    if (_smartSortActive) {
      list.sort((a, b) => {
        const sa = _smartScores[a.guid];
        const sb = _smartScores[b.guid];
        if (sa == null && sb == null) return b.publishedAt - a.publishedAt;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sb - sa;
      });
    } else {
      list.sort((a, b) => b.publishedAt - a.publishedAt);
    }
    return list;
  }

  function rssRenderSidebar() {
    if (!rssFeedListEl || !_rssState) return;
    rssFeedListEl.innerHTML = '';
    const allUnread = _rssState.articles.filter((a) => !a.read).length;
    const allBtn = document.createElement('button');
    allBtn.className = 'rss-feed-item' + (_rssState.activeFeedId === null ? ' active' : '');
    allBtn.innerHTML = `
      <span class="rss-feed-item-title">All feeds</span>
      ${allUnread ? `<span class="rss-feed-unread">${allUnread}</span>` : ''}
    `;
    allBtn.addEventListener('click', () => {
      _rssState.activeFeedId = null;
      if (_rssState.readingGuid) rssCloseArticle();
      rssRenderSidebar();
      rssRenderCards();
    });
    rssFeedListEl.appendChild(allBtn);

    for (const feed of _rssState.feeds) {
      const unread = _rssState.articles.filter((a) => a.feedId === feed.id && !a.read).length;
      const btn = document.createElement('button');
      btn.className = 'rss-feed-item' + (_rssState.activeFeedId === feed.id ? ' active' : '') + (feed.errorMessage ? ' errored' : '');
      btn.title = feed.errorMessage || feed.url;
      btn.innerHTML = `
        <span class="rss-feed-item-title">${rssEscape(feed.title || feed.url)}</span>
        ${unread ? `<span class="rss-feed-unread">${unread}</span>` : ''}
      `;
      btn.addEventListener('click', () => {
        _rssState.activeFeedId = feed.id;
        if (_rssState.readingGuid) rssCloseArticle();
        rssRenderSidebar();
        rssRenderCards();
      });
      rssFeedListEl.appendChild(btn);
    }
  }

  function rssEscape(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rssRenderCards() {
    if (!rssCardGridEl || !_rssState) return;
    const articles = rssFilteredArticles();
    const noFeeds = _rssState.feeds.length === 0;
    if (rssEmptyStateEl) rssEmptyStateEl.classList.toggle('hidden', !noFeeds);
    rssCardGridEl.classList.toggle('hidden', noFeeds);

    if (rssMainTitleEl) {
      const activeFeed = _rssState.activeFeedId
        ? _rssState.feeds.find((f) => f.id === _rssState.activeFeedId)
        : null;
      rssMainTitleEl.textContent = activeFeed ? activeFeed.title : 'All feeds';
    }
    if (rssMainMetaEl) {
      const unread = articles.filter((a) => !a.read).length;
      rssMainMetaEl.textContent = `${articles.length} article${articles.length === 1 ? '' : 's'}${unread ? ` · ${unread} unread` : ''}`;
    }

    rssCardGridEl.innerHTML = '';
    for (const art of articles) {
      const feed = _rssState.feeds.find((f) => f.id === art.feedId);
      const card = document.createElement('article');
      card.className = 'rss-card' + (art.read ? ' read' : '') + (art.starred ? ' starred' : '');
      card.innerHTML = `
        ${art.imageUrl ? `<div class="rss-card-image"><img src="${rssEscape(art.imageUrl)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></div>` : ''}
        <div class="rss-card-body">
          <h3 class="rss-card-title">${rssEscape(art.title)}</h3>
          <div class="rss-card-meta">
            <span class="rss-card-source">${rssEscape(feed?.title || '')}</span>
            <span class="rss-card-time">${rssRelativeTime(art.publishedAt)}</span>
          </div>
          <p class="rss-card-excerpt">${rssEscape(art.excerpt || '')}</p>
        </div>
      `;
      card.addEventListener('click', () => rssOpenArticle(art.guid));
      const thumbsRow = document.createElement('div');
      thumbsRow.className = 'rss-card-thumbs';
      const SVG_THUMB_UP =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v10H4V10h3zm3 10h7a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 18.3 9H14V5a3 3 0 0 0-3-3l-1 7v11z"/></svg>';
      const SVG_THUMB_UP_FILLED =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10v10H4V10h3zm3 10h7a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 18.3 9H14V5a3 3 0 0 0-3-3l-1 7v11z"/></svg>';
      const SVG_THUMB_DOWN =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V4h3v10h-3zm-3-10H7a2 2 0 0 0-2 1.7L3.7 12.7A2 2 0 0 0 5.7 15H10v4a3 3 0 0 0 3 3l1-7V4z"/></svg>';
      const SVG_THUMB_DOWN_FILLED =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 14V4h3v10h-3zm-3-10H7a2 2 0 0 0-2 1.7L3.7 12.7A2 2 0 0 0 5.7 15H10v4a3 3 0 0 0 3 3l1-7V4z"/></svg>';
      const up = document.createElement('button');
      up.className = 'rss-thumbs-up';
      up.innerHTML = SVG_THUMB_UP;
      up.title = 'More like this';
      up.addEventListener('click', async (e) => {
        e.stopPropagation();
        up.classList.add('active');
        up.innerHTML = SVG_THUMB_UP_FILLED;
        await smartCall('react', art.guid, 'like');
      });
      const down = document.createElement('button');
      down.className = 'rss-thumbs-down';
      down.innerHTML = SVG_THUMB_DOWN;
      down.title = 'Less like this';
      down.addEventListener('click', async (e) => {
        e.stopPropagation();
        down.classList.add('active');
        down.innerHTML = SVG_THUMB_DOWN_FILLED;
        await smartCall('react', art.guid, 'dislike');
        if (_smartSortActive) await smartRescoreAndRerender();
        else rssRenderCards();
      });
      thumbsRow.appendChild(up);
      thumbsRow.appendChild(down);
      card.appendChild(thumbsRow);
      rssCardGridEl.appendChild(card);
    }
  }

  function rssOpenArticle(guid) {
    const art = _rssState.articles.find((a) => a.guid === guid);
    if (!art) return;
    _rssState.readingGuid = guid;
    if (!art.read) {
      art.read = true;
      rssSaveCache();
      rssScheduleStateSync();
      rssRenderSidebar();
    }
    const feed = _rssState.feeds.find((f) => f.id === art.feedId);
    const headerHtml = `
      <header class="rss-reader-header">
        <div class="rss-reader-source">${rssEscape(feed?.title || '')}${art.author ? ' · ' + rssEscape(art.author) : ''} · ${rssRelativeTime(art.publishedAt)}</div>
        <h1 class="rss-reader-title">${rssEscape(art.title)}</h1>
      </header>
    `;
    rssReaderContentEl.innerHTML = headerHtml + `<div class="rss-reader-body">${art.contentHtml || rssEscape(art.excerpt || '')}</div>`;
    rssReaderStarBtn.classList.toggle('starred', art.starred);
    const thumbsUpBtn = document.getElementById('btn-rss-reader-thumbsup');
    const thumbsDownBtn = document.getElementById('btn-rss-reader-thumbsdown');
    if (thumbsUpBtn) {
      thumbsUpBtn.classList.remove('active');
      thumbsUpBtn.onclick = async () => {
        thumbsUpBtn.classList.add('active');
        if (thumbsDownBtn) thumbsDownBtn.classList.remove('active');
        await smartCall('react', art.guid, 'like');
      };
    }
    if (thumbsDownBtn) {
      thumbsDownBtn.classList.remove('active');
      thumbsDownBtn.onclick = async () => {
        thumbsDownBtn.classList.add('active');
        if (thumbsUpBtn) thumbsUpBtn.classList.remove('active');
        await smartCall('react', art.guid, 'dislike');
        if (_smartSortActive) await smartRescoreAndRerender();
        else rssRenderCards();
      };
    }
    if (rssReaderCaptionEl) {
      const plain = (art.contentHtml || art.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = plain ? plain.split(' ').length : 0;
      const minutes = Math.max(1, Math.round(words / 230));
      const parts = [];
      if (feed?.title) parts.push(rssEscape(feed.title));
      if (words > 20) parts.push(`${minutes} min read`);
      rssReaderCaptionEl.innerHTML = parts.join('<span class="dot">·</span>');
    }
    if (rssReaderProgressBarEl) rssReaderProgressBarEl.style.setProperty('--rss-read-progress', '0%');
    // Reset the main column's scroll so the absolutely-positioned overlay
    // anchors to the visible viewport, not to a scrolled-off position.
    const rssMainEl = document.getElementById('rss-main');
    if (rssMainEl) rssMainEl.scrollTop = 0;
    rssReaderOverlayEl.classList.remove('hidden');
    document.getElementById('rss-view')?.classList.add('rss-reading');
    rssReaderContentEl.scrollTop = 0;
  }

  function rssCloseArticle() {
    _rssState.readingGuid = null;
    rssReaderOverlayEl.classList.add('hidden');
    document.getElementById('rss-view')?.classList.remove('rss-reading');
    if (rssReaderProgressBarEl) rssReaderProgressBarEl.style.setProperty('--rss-read-progress', '0%');
  }

  if (rssReaderContentEl && rssReaderProgressBarEl) {
    rssReaderContentEl.addEventListener('scroll', () => {
      const max = rssReaderContentEl.scrollHeight - rssReaderContentEl.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (rssReaderContentEl.scrollTop / max) * 100)) : 0;
      rssReaderProgressBarEl.style.setProperty('--rss-read-progress', pct.toFixed(1) + '%');
    }, { passive: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _rssState?.readingGuid && !rssReaderOverlayEl.classList.contains('hidden')) {
      e.preventDefault();
      rssCloseArticle();
    }
  });

  // Reader overlay controls
  if (rssReaderBackBtn) rssReaderBackBtn.addEventListener('click', rssCloseArticle);
  if (rssReaderStarBtn) {
    rssReaderStarBtn.addEventListener('click', () => {
      if (!_rssState?.readingGuid) return;
      const art = _rssState.articles.find((a) => a.guid === _rssState.readingGuid);
      if (!art) return;
      art.starred = !art.starred;
      rssReaderStarBtn.classList.toggle('starred', art.starred);
      rssSaveCache();
      rssScheduleStateSync();
      rssRenderCards();
    });
  }
  if (rssReaderOpenBtn) {
    rssReaderOpenBtn.addEventListener('click', () => {
      if (!_rssState?.readingGuid) return;
      const art = _rssState.articles.find((a) => a.guid === _rssState.readingGuid);
      if (art?.url) window.open(art.url, '_blank', 'noopener');
    });
  }

  // Filter pills
  rssFilterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      if (!_rssState) return;
      _rssState.filter = pill.dataset.rssFilter;
      if (_rssState.readingGuid) rssCloseArticle();
      rssFilterPills.forEach((p) => p.classList.toggle('active', p === pill));
      rssRenderCards();
    });
  });

  if (rssRefreshBtn) {
    rssRefreshBtn.addEventListener('click', async () => {
      rssRefreshBtn.disabled = true;
      try { await rssRefreshAll(); } finally { rssRefreshBtn.disabled = false; }
    });
  }

  // Settings: feeds table
  function renderRssFeedsTable() {
    if (!rssFeedsTableEl || !_rssState) return;
    rssFeedsTableEl.innerHTML = '';
    if (_rssState.feeds.length === 0) {
      rssFeedsTableEl.innerHTML = '<p class="settings-hint-block">No feeds configured yet.</p>';
      return;
    }
    for (const feed of _rssState.feeds) {
      const row = document.createElement('div');
      row.className = 'rss-feed-row';
      row.innerHTML = `
        <div class="rss-feed-row-main">
          <div class="rss-feed-row-title">${rssEscape(feed.title || feed.url)}</div>
          <div class="rss-feed-row-url">${rssEscape(feed.url)}</div>
          ${feed.errorMessage ? `<div class="rss-feed-row-error">${rssEscape(feed.errorMessage)}</div>` : ''}
        </div>
        <button class="btn btn-secondary btn-small rss-feed-row-remove">Remove</button>
      `;
      row.querySelector('.rss-feed-row-remove').addEventListener('click', () => {
        _rssState.feeds = _rssState.feeds.filter((f) => f.id !== feed.id);
        _rssState.articles = _rssState.articles.filter((a) => a.feedId !== feed.id);
        rssSaveCache();
        rssScheduleStateSync();
        renderRssFeedsTable();
        rssRenderSidebar();
        rssRenderCards();
      });
      rssFeedsTableEl.appendChild(row);
    }
  }

  async function rssAddFeed(url, titleHint) {
    if (!_rssState) ensureRssStateForSettings();
    if (_rssState.feeds.some((f) => f.url === url)) {
      showToast('Feed already added', 'warning');
      return;
    }
    const feed = {
      id: crypto.randomUUID(),
      url,
      title: (titleHint || url).trim(),
      lastFetchedAt: 0,
      errorMessage: '',
    };
    _rssState.feeds.push(feed);
    renderRssFeedsTable();
    rssRenderSidebar();
    const res = await rssFetchOneFeed(feed);
    renderRssFeedsTable();
    rssRenderSidebar();
    rssRenderCards();
    rssSaveCache();
    rssScheduleStateSync();
    if (res.success) {
      showToast(`Added "${feed.title}" (${res.count} items)`, 'success');
    } else {
      showToast(`Failed: ${res.error}`, 'error');
    }
  }

  function ensureRssStateForSettings() {
    if (_rssState) return;
    const cached = rssLoadCache();
    _rssState = cached ? { ...rssCreateState(), ...cached } : rssCreateState();
  }

  if (rssFeedAddBtn) {
    rssFeedAddBtn.addEventListener('click', async () => {
      const url = (rssFeedNewUrlEl.value || '').trim();
      if (!url) return;
      try { new URL(url); } catch (_) { showToast('Invalid URL', 'error'); return; }
      const title = (rssFeedNewTitleEl.value || '').trim();
      rssFeedNewUrlEl.value = '';
      rssFeedNewTitleEl.value = '';
      await rssAddFeed(url, title);
    });
  }

  if (rssOpmlImportBtn) {
    rssOpmlImportBtn.addEventListener('click', async () => {
      if (!window.electronAPI?.openOpmlFile) return;
      const res = await window.electronAPI.openOpmlFile();
      if (res.canceled) return;
      if (!res.success) {
        rssOpmlStatusEl.textContent = res.error;
        rssOpmlStatusEl.className = 'settings-test-result test-fail';
        return;
      }
      try {
        ensureRssStateForSettings();
        const doc = new DOMParser().parseFromString(res.content, 'text/xml');
        const outlines = doc.querySelectorAll('outline[xmlUrl], outline[xmlurl]');
        let added = 0;
        outlines.forEach((ol) => {
          const url = ol.getAttribute('xmlUrl') || ol.getAttribute('xmlurl');
          const title = ol.getAttribute('title') || ol.getAttribute('text') || url;
          if (url && !_rssState.feeds.some((f) => f.url === url)) {
            _rssState.feeds.push({
              id: crypto.randomUUID(),
              url,
              title,
              lastFetchedAt: 0,
              errorMessage: '',
            });
            added++;
          }
        });
        renderRssFeedsTable();
        rssSaveCache();
        rssScheduleStateSync();
        rssOpmlStatusEl.textContent = `Imported ${added} feed${added === 1 ? '' : 's'}`;
        rssOpmlStatusEl.className = 'settings-test-result test-ok';
        rssRefreshAll({ render: currentMode === 'rss' }).catch(() => {});
        try {
          const sugg = await smartCall('suggestFromOpml', res.content);
          const list = sugg?.suggestions || [];
          if (list.length) {
            const pick = confirm(
              `OPML imported. Suggested interests: ${list.map((s) => s.name).join(', ')}\n\nAdd these?`
            );
            if (pick) {
              for (const s of list) await smartCall('addInterest', s.name);
              await smartRefreshInterests();
            }
          }
        } catch (_) { /* silent */ }
      } catch (err) {
        rssOpmlStatusEl.textContent = `Parse error: ${err.message}`;
        rssOpmlStatusEl.className = 'settings-test-result test-fail';
      }
    });
  }

  if (rssOpmlExportBtn) {
    rssOpmlExportBtn.addEventListener('click', async () => {
      ensureRssStateForSettings();
      const outlines = _rssState.feeds.map((f) =>
        `    <outline type="rss" text="${rssEscape(f.title)}" title="${rssEscape(f.title)}" xmlUrl="${rssEscape(f.url)}"/>`
      ).join('\n');
      const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>MarkAllDown RSS Feeds</title></head>
  <body>
${outlines}
  </body>
</opml>
`;
      if (!window.electronAPI?.saveFile) return;
      const res = await window.electronAPI.saveFile({
        defaultPath: 'mad-feeds.opml',
        content: opml,
      });
      if (res?.success) {
        rssOpmlStatusEl.textContent = 'Exported';
        rssOpmlStatusEl.className = 'settings-test-result test-ok';
      }
    });
  }

  // Keep settings fields reactive — update _rssSettings + timer when user changes them
  if (rssRefreshIntervalEl) {
    rssRefreshIntervalEl.addEventListener('change', () => {
      _rssSettings.refreshIntervalMinutes = Math.max(5, parseInt(rssRefreshIntervalEl.value, 10) || 30);
      rssStartAutoRefresh();
    });
  }
  if (rssBackgroundRefreshEl) {
    rssBackgroundRefreshEl.addEventListener('change', () => {
      _rssSettings.backgroundRefresh = rssBackgroundRefreshEl.checked;
      rssStartAutoRefresh();
    });
  }
  if (rssSyncEnabledEl) {
    rssSyncEnabledEl.addEventListener('change', () => {
      _rssSettings.syncEnabled = rssSyncEnabledEl.checked;
    });
  }
  if (rssOutputDirEl) {
    rssOutputDirEl.addEventListener('change', () => {
      _rssSettings.outputDir = (rssOutputDirEl.value || '/rss').trim() || '/rss';
    });
  }

  async function initRss() {
    if (_rssInitialized) return;
    _rssInitialized = true;
    if (!_rssState) {
      const cached = rssLoadCache();
      _rssState = cached ? { ...rssCreateState(), ...cached } : rssCreateState();
    }
    // Load settings (feeds list from settings, merged with cache)
    if (window.electronAPI?.loadSettings) {
      try {
        const s = await window.electronAPI.loadSettings();
        const rss = s?.rss || {};
        _rssSettings = {
          refreshIntervalMinutes: rss.refreshIntervalMinutes || 30,
          backgroundRefresh: rss.backgroundRefresh !== false,
          outputDir: rss.outputDir || '/rss',
          syncEnabled: rss.syncEnabled !== false,
        };
        // Merge settings feeds into state (settings is source of truth for feed list)
        if (Array.isArray(rss.feeds)) {
          for (const sf of rss.feeds) {
            if (!_rssState.feeds.some((f) => f.url === sf.url)) {
              _rssState.feeds.push({
                id: sf.id || crypto.randomUUID(),
                url: sf.url,
                title: sf.title || sf.url,
                lastFetchedAt: 0,
                errorMessage: '',
              });
            }
          }
          // Remove feeds no longer in settings
          const settingsUrls = new Set(rss.feeds.map((f) => f.url));
          _rssState.feeds = _rssState.feeds.filter((f) => settingsUrls.has(f.url));
          _rssState.articles = _rssState.articles.filter((a) =>
            _rssState.feeds.some((f) => f.id === a.feedId)
          );
        }
      } catch (_) { /* silent */ }
    }
    await rssPullStateFromWebdav();
    rssRenderSidebar();
    rssRenderCards();
    rssStartAutoRefresh();
    // Auto-refresh on first open
    rssRefreshAll().catch(() => {});
    smartWireInterestForm();
    smartWireSortPill();
    smartRefreshInterests();
    smartMaybePromote();
  }

  // Start background refresh timer even if tab hasn't been opened yet — per spec
  (async () => {
    if (window.electronAPI?.loadSettings) {
      try {
        const s = await window.electronAPI.loadSettings();
        const rss = s?.rss || {};
        _rssSettings = {
          refreshIntervalMinutes: rss.refreshIntervalMinutes || 30,
          backgroundRefresh: rss.backgroundRefresh !== false,
          outputDir: rss.outputDir || '/rss',
          syncEnabled: rss.syncEnabled !== false,
        };
        if (_rssSettings.backgroundRefresh && Array.isArray(rss.feeds) && rss.feeds.length) {
          // Lightweight bootstrap: hydrate state, start timer. Actual rendering waits for initRss().
          const cached = rssLoadCache();
          _rssState = cached ? { ...rssCreateState(), ...cached } : rssCreateState();
          for (const sf of rss.feeds) {
            if (!_rssState.feeds.some((f) => f.url === sf.url)) {
              _rssState.feeds.push({
                id: sf.id || crypto.randomUUID(),
                url: sf.url,
                title: sf.title || sf.url,
                lastFetchedAt: 0,
                errorMessage: '',
              });
            }
          }
          rssStartAutoRefresh();
        }
      } catch (_) { /* silent */ }
    }
  })();

  // ════════════════════════════════════════════
  //  Claude pop-up windows (diff + plan)
  // ════════════════════════════════════════════

  function _activePtyIdForClaudeViewer() {
    // Claude pop-ups always target a terminal tab's Claude session. Use the
    // active (last-used) terminal tab regardless of the currently-visible MAD
    // mode — hitting Ctrl+Shift+D from Reader should still bind to the ssh
    // tab's session, not fall through to local-most-recent.
    const tab = _termTabs.find((t) => t.id === _activeTermTabId);
    return (tab && tab.ptyId) || null;
  }

  // Ctrl+Shift+D / Ctrl+Shift+P are registered as app-menu accelerators
  // (main.js). We used to also listen at document capture, but that produced
  // a duplicate IPC per press; the menu path is enough on its own.
  if (window.electronAPI && window.electronAPI.onMenuOpenDiffWindow) {
    window.electronAPI.onMenuOpenDiffWindow(() => {
      window.electronAPI.openDiffWindow({ ptyId: _activePtyIdForClaudeViewer() });
    });
  }
  if (window.electronAPI && window.electronAPI.onMenuOpenPlanWindow) {
    window.electronAPI.onMenuOpenPlanWindow(() => {
      window.electronAPI.openPlanWindow({ ptyId: _activePtyIdForClaudeViewer() });
    });
  }


  // Release renderer resources on reload / window close. Chromium keeps a
  // /dev/shm fd per live canvas-backed surface (pdf.js pages, xterm atlases,
  // offscreen iframes); without this handler, Cmd/Ctrl-R reload across a
  // long-running session accumulates fds until the renderer hits
  // RLIMIT_NOFILE and freezes (observed on Ubuntu at ~1024 fds).
  window.addEventListener('beforeunload', () => {
    try {
      if (markdownBody) {
        if (markdownBody._pdfObserver) {
          try { markdownBody._pdfObserver.disconnect(); } catch (_) {}
          markdownBody._pdfObserver = null;
        }
        if (markdownBody._pdfDoc) {
          _cancelPdfRenderTasks(markdownBody._pdfDoc);
          try { markdownBody._pdfDoc.destroy(); } catch (_) {}
          markdownBody._pdfDoc = null;
        }
      }
    } catch (_) {}
    try {
      for (const tab of _termTabs) {
        if (tab.terminal) {
          try { tab.terminal.dispose(); } catch (_) {}
          tab.terminal = null;
        }
        if (tab.ptyId) {
          try { window.electronAPI.terminalKill(tab.ptyId); } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      if (_rssRefreshTimer) { clearInterval(_rssRefreshTimer); _rssRefreshTimer = null; }
    } catch (_) {}
    try { _cleanupLatexExport('unload'); } catch (_) {}
  });

  // ── Initialise ──

  localizeShortcutHints();
  initAgentsList();
})();
