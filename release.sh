#!/usr/bin/env bash
set -euo pipefail

APP_NAME="MarkAllDown"
VERSION=$(node -p "require('./package.json').version")
DIST_DIR="dist"

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Cross-platform build: produces Linux and macOS artifacts from either host.
Cleans dist/ then runs electron-builder for current platform + cross-compiled targets in one go.
Run on Linux or macOS (Darwin). Windows can be added from either host (see BUILD_WIN).

Options:
  --help    Show this help.

Environment:
  BUILD_DEB=1   Also build a .deb package (Linux target; run on Linux for best results).
  BUILD_WIN=1   Also build Windows (nsis + zip). On Linux requires Wine; from macOS usually works.

Examples:
  $0
  BUILD_DEB=1 $0
  BUILD_WIN=1 $0

Artifacts are written to ./$DIST_DIR/
  Linux:   .AppImage, .tar.gz (and .deb if BUILD_DEB=1)
  macOS:   .dmg, .zip
  Windows: .exe (NSIS), .zip (if BUILD_WIN=1)
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

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
	echo "[1/4] Installing dependencies..."
	npm install
else
	echo "[1/4] Dependencies already installed."
fi

# Clean previous artifacts so both Linux and Mac builds are refreshed
echo "[2/4] Cleaning previous build artifacts..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"
echo "[3/4] Detected platform: $OS $ARCH"
echo ""

# Cross-platform: one electron-builder call for Linux + Mac (and optionally Win).
# Builds run in parallel; output dir is cleaned by electron-builder.
EXTRA_ARGS=()
[[ "${BUILD_WIN:-0}" == "1" ]] && EXTRA_ARGS+=(--win)

case "$OS" in
Linux)
	echo "[4/4] Building for Linux + macOS (cross-platform)..."
	npx electron-builder --linux AppImage tar.gz --mac zip "${EXTRA_ARGS[@]}" || {
		echo "  [warn] Some targets failed (e.g. Mac dmg needs macOS host). Check artifacts."
	}
	if [[ "${BUILD_DEB:-0}" == "1" ]]; then
		echo "Building .deb (BUILD_DEB=1)..."
		npx electron-builder --linux deb || echo "  [warn] deb build failed."
	fi
	;;
Darwin)
	echo "[4/4] Building for macOS + Linux (cross-platform)..."
	npx electron-builder --mac dmg zip --linux AppImage tar.gz "${EXTRA_ARGS[@]}" || {
		echo "  [warn] Some targets failed. Check artifacts."
	}
	if [[ "${BUILD_DEB:-0}" == "1" ]]; then
		echo "Building .deb (BUILD_DEB=1)..."
		npx electron-builder --linux deb || echo "  [warn] deb build failed — run on Linux for deb."
	fi
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
