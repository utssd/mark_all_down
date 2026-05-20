const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function readProjectFile(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

test('terminal tabs repaint WebGL glyph atlases after GPU process replacement', () => {
  const main = readProjectFile('main.js');
  const preload = readProjectFile('preload.js');
  const app = readProjectFile('app.js');

  assert.match(main, /app\.on\('child-process-gone'[\s\S]*type\s*===\s*'GPU'[\s\S]*gpu:process-gone/);
  assert.match(preload, /onGpuProcessGone:\s*\(cb\)\s*=>\s*ipcRenderer\.on\('gpu:process-gone'/);
  assert.match(app, /onGpuProcessGone\(\(details\)\s*=>\s*\{[\s\S]*_scheduleTerminalRendererRepair\('gpu-process-gone'/);
  assert.match(app, /function _repairTerminalWebglRenderer\(tab, reason\)[\s\S]*clearTextureAtlas\(\)[\s\S]*terminal\.refresh\(0, Math\.max\(0, terminal\.rows - 1\)\)/);
});
