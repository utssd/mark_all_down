// Unit tests for the PURE string helpers in render/markdown-render.js
// (extractMath / maybeStripFrontMatter). DOM-rendering functions are covered
// by the browser smoke harness in Task 3, not here.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the module into a sandbox that provides the globals it expects.
function loadModule() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'render', 'markdown-render.js'), 'utf-8');
  const sandbox = {
    window: {},
    document: { createElement: () => ({ querySelectorAll: () => [], innerHTML: '' }) },
    marked: { parse: (s) => s, setOptions: () => {}, Renderer: function () {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.MadMarkdownRender;
}

test('module exposes the expected API on window.MadMarkdownRender', () => {
  const M = loadModule();
  for (const name of ['init', 'renderMarkdown', 'renderMarkdownProgressive', 'renderPlainText',
                       'extractMath', 'restoreMath', 'maybeStripFrontMatter', 'renderMermaidBlocks',
                       'renderHtmlInto']) {
    assert.equal(typeof M[name], 'function', `${name} should be a function`);
  }
});

test('renderHtmlInto injects the HTML into the target and runs KaTeX auto-render over the DOM', async () => {
  // renderHtmlInto is DOM-based: it sets targetEl.innerHTML then calls
  // window.renderMathInElement (auto-render). We stub a minimal DOM + globals to
  // assert that flow. The real KaTeX/mermaid output is covered by the browser
  // smoke (DOM-dependent), not here.
  const code = fs.readFileSync(path.join(__dirname, '..', 'render', 'markdown-render.js'), 'utf-8');
  const calls = { autoRenderTargets: [], loadedScripts: [] };
  const win = {};
  win.renderMathInElement = (el) => { calls.autoRenderTargets.push(el); };
  const sandbox = {
    window: win,
    document: {
      createElement: () => {
        const el = {};
        Object.defineProperty(el, 'onload', { set(fn) { setTimeout(fn, 0); }, configurable: true });
        Object.defineProperty(el, 'src', { set(v) { calls.loadedScripts.push(v); }, configurable: true });
        return el;
      },
      head: { appendChild: () => {} },
    },
    marked: { parse: (s) => s, setOptions: () => {}, Renderer: function () {} },
    katex: { renderToString: (src) => `<span class="katex">${src}</span>` },
    mermaid: { initialize: () => {}, render: async () => ({ svg: '<svg></svg>' }) },
    setTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const M = sandbox.window.MadMarkdownRender;
  M.init({ getStripFrontMatter: () => true, getTheme: () => 'dark', thresholds: {}, renderMindmapVizBlocks: null });

  // Minimal target element: records innerHTML, returns [] from querySelectorAll.
  const target = { innerHTML: '', querySelectorAll: () => [] };
  await M.renderHtmlInto(target, '<h1>Doc</h1><p>$E=mc^2$</p>');

  assert.equal(target.innerHTML, '<h1>Doc</h1><p>$E=mc^2$</p>'); // HTML injected verbatim (no string mangling)
  assert.equal(calls.autoRenderTargets.length, 1);               // auto-render ran once
  assert.equal(calls.autoRenderTargets[0], target);              // …over the target element
  assert.ok(calls.loadedScripts.some((s) => /auto-render/.test(s)), 'auto-render.min.js loaded');
});

test('maybeStripFrontMatter strips YAML front matter when enabled', () => {
  const M = loadModule();
  M.init({ getStripFrontMatter: () => true, getTheme: () => 'dark', thresholds: {}, renderMindmapVizBlocks: null });
  const input = '---\ntitle: x\n---\n# Body\n';
  assert.equal(M.maybeStripFrontMatter(input), '# Body\n');
});

test('maybeStripFrontMatter leaves content intact when disabled', () => {
  const M = loadModule();
  M.init({ getStripFrontMatter: () => false, getTheme: () => 'dark', thresholds: {}, renderMindmapVizBlocks: null });
  const input = '---\ntitle: x\n---\n# Body\n';
  assert.equal(M.maybeStripFrontMatter(input), input);
});

test('extractMath pulls $$display$$ and $inline$ into placeholders', () => {
  const M = loadModule();
  M.init({ getStripFrontMatter: () => true, getTheme: () => 'dark', thresholds: {}, renderMindmapVizBlocks: null });
  const { cleaned, blocks } = M.extractMath('a $$x^2$$ b $y$ c');
  assert.equal(blocks.length, 2);
  assert.match(cleaned, /MATHPH0ENDMATHPH/);
  assert.match(cleaned, /MATHPH1ENDMATHPH/);
});

test('extractMath does not touch math inside code spans', () => {
  const M = loadModule();
  M.init({ getStripFrontMatter: () => true, getTheme: () => 'dark', thresholds: {}, renderMindmapVizBlocks: null });
  const { blocks } = M.extractMath('`$not math$` text');
  assert.equal(blocks.length, 0);
});
