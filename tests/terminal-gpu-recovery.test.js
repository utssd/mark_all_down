const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function readProjectFile(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

test('GPU process death surfaces a reload banner instead of attempting in-process repair', () => {
  const main = readProjectFile('main.js');
  const preload = readProjectFile('preload.js');
  const app = readProjectFile('app.js');
  const html = readProjectFile('index.html');
  const css = readProjectFile('style.css');

  // main.js forwards Electron's child-process-gone GPU event to the renderer
  assert.match(main, /app\.on\('child-process-gone'[\s\S]*type\s*===\s*'GPU'[\s\S]*gpu:process-gone/);

  // preload.js exposes onGpuProcessGone over the gpu:process-gone IPC
  assert.match(preload, /onGpuProcessGone:\s*\(cb\)\s*=>\s*ipcRenderer\.on\('gpu:process-gone'/);

  // index.html declares the banner element with a Reload button
  assert.match(html, /id="terminal-gpu-warning"/);
  assert.match(html, /id="terminal-gpu-reload-btn"/);

  // style.css ships banner styling (mirrors the existing .agents-warning pattern)
  assert.match(css, /\.terminal-warning\b/);
  assert.match(css, /\.terminal-warning-action\b/);

  // app.js wires the banner: shows it on gpu:process-gone, reloads on button click
  assert.match(app, /getElementById\('terminal-gpu-warning'\)/);
  assert.match(app, /getElementById\('terminal-gpu-reload-btn'\)/);
  assert.match(app, /btnTerminalGpuReload\.addEventListener\('click',\s*\(\)\s*=>\s*window\.location\.reload\(\)\)/);
  assert.match(
    app,
    /onGpuProcessGone\(\(details\)\s*=>\s*\{[\s\S]*terminalGpuWarning\.classList\.remove\('hidden'\)/
  );

  // The old in-process repair scaffolding must be gone — it never worked once
  // the GPU process recycled and was misleading us about the recovery path.
  assert.doesNotMatch(app, /_repairTerminalWebglRenderer/);
  assert.doesNotMatch(app, /_scheduleTerminalRendererRepair/);
  assert.doesNotMatch(app, /_queueTerminalRendererRepair/);
});
