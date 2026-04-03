'use strict';

// Globals shared by all contexts
const commonGlobals = {
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Promise: 'readonly',
  JSON: 'readonly',
  Math: 'readonly',
  Date: 'readonly',
  Error: 'readonly',
  Array: 'readonly',
  Object: 'readonly',
  String: 'readonly',
  Number: 'readonly',
  Boolean: 'readonly',
  RegExp: 'readonly',
  Map: 'readonly',
  Set: 'readonly',
  Symbol: 'readonly',
  URL: 'readonly',
};

const nodeGlobals = {
  ...commonGlobals,
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
};

const browserGlobals = {
  ...commonGlobals,
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  fetch: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  performance: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  // Third-party libs loaded via <script> in index.html
  marked: 'readonly',
  mermaid: 'readonly',
  katex: 'readonly',
  CodeMirror: 'readonly',
};

const sharedRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-undef': 'warn',
  'no-console': 'off',
  'no-var': 'warn',
  eqeqeq: ['warn', 'smart'],
};

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', '**/*.min.js'],
  },
  {
    // Main process + preload (Node.js CommonJS)
    files: ['main.js', 'preload.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: sharedRules,
  },
  {
    // Renderer process (browser context)
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: sharedRules,
  },
];
