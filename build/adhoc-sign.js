/**
 * afterPack hook — ad-hoc sign the macOS .app when no Developer ID cert is present.
 *
 * Ad-hoc signing (`codesign --sign -`) gives the app a valid (but untrusted) signature so
 * macOS shows "unidentified developer" instead of the unbypassable "damaged" error.
 *
 * To enable full signing + notarization, configure CSC_LINK / APPLE_ID secrets and
 * switch to a real Developer ID certificate — this hook becomes a no-op in that case.
 */
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return; // real cert present, skip

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  const entitlements = path.join(__dirname, 'entitlements.mac.plist');

  try {
    execSync(`codesign --force --deep --sign - --entitlements "${entitlements}" "${appPath}"`, { stdio: 'pipe' });
    console.log(`Ad-hoc signed: ${appPath}`);
  } catch (err) {
    console.warn('Ad-hoc signing failed (non-fatal):', err.message);
  }
};
