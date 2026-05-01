#!/usr/bin/env bash
set -euo pipefail

APP_NAME="MarkAllDown"
VERSION=$(node -p "require('./package.json').version")
DIST_DIR="dist"

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Local build: produces artifacts for the current host platform only.
Cross-platform compilation is not supported because the app includes native
modules (node-pty) that must be compiled on the target OS. To build for all
platforms, push a v* tag to GitHub to trigger the CI release workflow
(.github/workflows/build.yml), which builds on Linux, macOS, and Windows runners.

Options:
  --help    Show this help.

Environment:
  BUILD_DEB=1   Also build a .deb package (Linux only).

Examples:
  $0
  BUILD_DEB=1 $0

Artifacts are written to ./$DIST_DIR/
  Linux:   .AppImage, .tar.gz (and .deb if BUILD_DEB=1)
  macOS:   .dmg, .zip
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--help | -h)
		usage
		exit 0
		;;
	*)
		echo "Unknown option: $1"
		usage
		exit 1
		;;
	esac
done

echo "========================================="
echo "  $APP_NAME v$VERSION — Release Build"
echo "========================================="
echo ""

# Clean up orphan MarkAllDown AppImage wrappers + leaked FUSE mounts from
# previous runs. See cleanup-stale-mad.sh for full rationale.
if [[ "$(uname -s)" == "Linux" ]]; then
	source "$(dirname "${BASH_SOURCE[0]}")/cleanup-stale-mad.sh"
	cleanup_stale_mad_processes
fi


# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
	echo "[1/4] Installing dependencies..."
	npm install
else
	echo "[1/4] Dependencies already installed."
fi

# Clean previous artifacts
echo "[2/4] Cleaning previous build artifacts..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"
echo "[3/4] Detected platform: $OS $ARCH"
echo ""

case "$OS" in
Linux)
	echo "[4/4] Building for Linux..."
	echo "  Note: Cross-platform compilation is not supported with native modules."
	echo "  To build for macOS/Windows, push a v* tag to trigger the GitHub Actions workflow."
	echo ""
	npx electron-builder --publish never --linux AppImage tar.gz
	if [[ "${BUILD_DEB:-0}" == "1" ]]; then
		echo "Building .deb (BUILD_DEB=1)..."
		npx electron-builder --publish never --linux deb || echo "  [warn] deb build failed."
	fi
	;;
Darwin)
	echo "[4/4] Building for macOS..."
	echo "  Note: Cross-platform compilation is not supported with native modules."
	echo "  To build for Linux/Windows, push a v* tag to trigger the GitHub Actions workflow."
	echo ""
	npx electron-builder --publish never --mac dmg zip
	;;
*)
	echo "Unsupported platform: $OS"
	echo "Run this script on Linux or macOS."
	exit 1
	;;
esac

echo ""
echo "========================================="
echo "  Build complete! Artifacts in ./$DIST_DIR/"
echo "========================================="
echo ""

# List the produced artifacts
echo "Artifacts:"
find "$DIST_DIR" -maxdepth 2 -type f \( \
	-name "*.deb" -o \
	-name "*.AppImage" -o \
	-name "*.tar.gz" -o \
	-name "*.dmg" -o \
	-name "*.zip" -o \
	-name "*.exe" \
	\) -exec echo "  {}" \;
