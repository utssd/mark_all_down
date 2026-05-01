/**
 * Notarization hook for electron-builder (afterSign).
 *
 * Required environment variables:
 *   APPLE_ID                  — your Apple ID email
 *   APPLE_TEAM_ID             — your 10-character Team ID (from developer.apple.com)
 *   APPLE_APP_SPECIFIC_PASSWORD — app-specific password generated at appleid.apple.com
 *
 * Set SKIP_NOTARIZE=1 to skip notarization (e.g. during local builds).
 */
const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') return;
  if (process.env.SKIP_NOTARIZE) {
    console.log('Skipping notarization (SKIP_NOTARIZE set)');
    return;
  }

  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = process.env;
  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn(
      'Skipping notarization: APPLE_ID, APPLE_TEAM_ID, or APPLE_APP_SPECIFIC_PASSWORD not set'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}…`);
  await notarize({
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
  console.log('Notarization complete.');
};
