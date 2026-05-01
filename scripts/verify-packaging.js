#!/usr/bin/env node
/**
 * Packaging verification script.
 *
 * Checks that the vendor bundle and electron-builder config are correctly set up
 * so that webdav is reliably included in every packaged build.
 *
 * Run:  node scripts/verify-packaging.js
 *       npm run test:packaging
 *       node scripts/verify-packaging.js --asar dist/mac/MarkAllDown.app/Contents/Resources/app.asar
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function pass(msg) {
  console.log('  \u2713', msg);
}
function fail(msg) {
  console.error('  \u2717', msg);
  failures++;
}
function section(title) {
  console.log('\n' + title);
}

// ── 1. vendor bundle exists and exports createClient ─────────────────────────
section('1. vendors/webdav.js bundle');

const vendorPath = path.join(ROOT, 'vendors', 'webdav.js');
if (!fs.existsSync(vendorPath)) {
  fail(
    'vendors/webdav.js not found — run: npm run vendor:webdav\n' +
      '  This file must be committed so it is available at build time.'
  );
} else {
  pass('vendors/webdav.js exists');
  try {
    const { createClient } = require(vendorPath);
    if (typeof createClient === 'function') {
      pass('vendors/webdav.js exports createClient correctly');
    } else {
      fail('vendors/webdav.js does not export createClient as a function');
    }
  } catch (e) {
    fail('vendors/webdav.js failed to load: ' + e.message);
  }
}

// ── 2. main.js uses the vendor bundle ────────────────────────────────────────
section('2. main.js require path');

const mainJs = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
if (mainJs.includes("require('./vendors/webdav')")) {
  pass("main.js uses require('./vendors/webdav')");
} else if (mainJs.includes("require('webdav')")) {
  fail(
    "main.js still uses require('webdav') — change to require('./vendors/webdav') " +
      'so the vendor bundle is used instead of node_modules'
  );
} else {
  fail('main.js does not require webdav at all');
}

// ── 3. package.json build config ─────────────────────────────────────────────
section('3. electron-builder config (package.json)');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const build = pkg.build || {};
const files = build.files || [];

if (files.includes('vendors/webdav.js')) {
  pass('vendors/webdav.js is in build.files');
} else {
  fail(
    'vendors/webdav.js is missing from build.files — it will not be included in the packaged app'
  );
}

const misleadingEntry = files.find((f) => f === 'node_modules/**/*' || f === 'node_modules/**');
if (misleadingEntry) {
  fail(
    `build.files contains "${misleadingEntry}" — this is silently ignored by electron-builder. Remove it.`
  );
} else {
  pass('build.files has no misleading node_modules/**/* glob');
}

if (build.includeSubNodeModules === true) {
  fail(
    'includeSubNodeModules: true is still set — it has no effect with the vendor bundle approach. Remove it.'
  );
} else {
  pass('includeSubNodeModules not set (correct for vendor bundle approach)');
}

// ── 4. optional: inspect a built asar ────────────────────────────────────────
const asarArg = process.argv.indexOf('--asar');
if (asarArg !== -1 && process.argv[asarArg + 1]) {
  const asarPath = process.argv[asarArg + 1];
  section(`4. asar inspection: ${asarPath}`);

  try {
    const asar = require(path.join(ROOT, 'node_modules', '@electron', 'asar'));
    const asarFiles = asar.listPackage(asarPath);

    const vendorInAsar = asarFiles.some((f) => f.endsWith('vendors/webdav.js'));
    if (vendorInAsar) {
      pass('asar contains vendors/webdav.js');
    } else {
      fail('asar is MISSING vendors/webdav.js — check build.files in package.json');
    }

    const rawRequire = asarFiles.some(
      (f) => f.includes('main.js') && mainJs.includes("require('webdav')")
    );
    if (!rawRequire) {
      pass('asar main.js does not use bare require(webdav)');
    }
  } catch (e) {
    console.log('  (skipped — asar module not available:', e.message + ')');
    console.log('  Manual check: npx asar list ' + asarPath + ' | grep vendors');
  }
} else {
  section('4. asar inspection');
  console.log('  (skipped — pass --asar path/to/app.asar to enable)');
  console.log(
    '  Example after build: node scripts/verify-packaging.js ' +
      '--asar dist/linux-unpacked/resources/app.asar'
  );
}

// ── Result ───────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log('All checks passed.');
  process.exit(0);
} else {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
