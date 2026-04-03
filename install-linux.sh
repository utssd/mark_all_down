#!/usr/bin/env bash
set -euo pipefail

APP_NAME="MarkAllDown"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
DO_BUILD=false
SYSTEM_INSTALL=false

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Install $APP_NAME on Linux from built artifacts in dist/.

Options:
  --build    Build Linux artifacts first, then install (npm run build:linux).
  --system   Install for all users (/usr/local/share, /usr/local/bin; requires sudo).
  --help     Show this help.

Artifacts are used in order: .AppImage (default), .tar.gz. Optional: .deb if built (npm run build:deb or BUILD_DEB=1 ./release.sh).
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--build)
		DO_BUILD=true
		shift
		;;
	--system)
		SYSTEM_INSTALL=true
		shift
		;;
	--help)
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

# Platform check
if [[ "$(uname -s)" != "Linux" ]]; then
	echo "This script is for Linux only. Detected: $(uname -s)"
	exit 1
fi

# Resolve version from package.json
VERSION=""
if [[ -f "$SCRIPT_DIR/package.json" ]]; then
	VERSION="$(node -p "require('$SCRIPT_DIR/package.json').version" 2>/dev/null)" || true
fi
[[ -z "$VERSION" ]] && VERSION="unknown"

# Find newest artifact by mtime (one per type)
find_artifact() {
	local ext="$1"
	find "$DIST_DIR" -maxdepth 1 -type f -name "*${ext}" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-
}

run_build() {
	echo "Building Linux artifacts..."
	if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
		echo "Installing dependencies..."
		(cd "$SCRIPT_DIR" && npm install)
	fi
	(cd "$SCRIPT_DIR" && npm run build:linux)
}

# Ensure dist exists
mkdir -p "$DIST_DIR"

# Build first if --build was passed
if [[ "$DO_BUILD" == "true" ]]; then
	run_build
fi

# Locate artifacts
DEB="$(find_artifact .deb)"
APPIMAGE="$(find_artifact .AppImage)"
TARBALL="$(find_artifact .tar.gz)"

if [[ -z "$DEB" && -z "$APPIMAGE" && -z "$TARBALL" ]]; then
	echo "No Linux artifacts found in $DIST_DIR."
	echo "Run: npm run build:linux"
	echo "Or: $0 --build"
	exit 1
fi

# Choose artifact: prefer .AppImage (default), then .deb, then .tar.gz
ARTIFACT=""
INSTALL_TYPE=""
if [[ -n "$APPIMAGE" && -f "$APPIMAGE" ]]; then
	ARTIFACT="$APPIMAGE"
	INSTALL_TYPE="appimage"
elif [[ -n "$DEB" && -f "$DEB" ]]; then
	ARTIFACT="$DEB"
	INSTALL_TYPE="deb"
elif [[ -n "$TARBALL" && -f "$TARBALL" ]]; then
	ARTIFACT="$TARBALL"
	INSTALL_TYPE="tarball"
fi

if [[ -z "$ARTIFACT" || ! -f "$ARTIFACT" ]]; then
	echo "No valid artifact found."
	exit 1
fi

echo "Installing from: $ARTIFACT ($INSTALL_TYPE)"

case "$INSTALL_TYPE" in
deb)
	sudo dpkg -i "$ARTIFACT" || true
	sudo apt-get install -f -y || true
	echo "Installed (deb). You can run $APP_NAME from your application menu or: markalldown"
	;;
appimage)
	if [[ "$SYSTEM_INSTALL" == "true" ]]; then
		INSTALL_DIR="/usr/local/share/$APP_NAME"
		BIN_DIR="/usr/local/bin"
		APPIMAGE_DEST="$INSTALL_DIR/$APP_NAME.AppImage"
		sudo mkdir -p "$INSTALL_DIR"
		sudo cp "$ARTIFACT" "$APPIMAGE_DEST"
		sudo chmod +x "$APPIMAGE_DEST"
		sudo ln -sf "$APPIMAGE_DEST" "$BIN_DIR/markalldown"
		sudo ln -sf "$APPIMAGE_DEST" "$BIN_DIR/$APP_NAME"
		# Desktop file for app menu
		DESKTOP="/usr/share/applications/${APP_NAME}.desktop"
		sudo tee "$DESKTOP" >/dev/null <<DESKTOP
[Desktop Entry]
Name=$APP_NAME
Exec=$APPIMAGE_DEST %F
Icon=text-editor
Type=Application
Categories=Utility;TextEditor;
MimeType=text/markdown;
DESKTOP
		echo "Installed to $INSTALL_DIR. Run: markalldown or $APP_NAME"
	else
		BIN_DIR="${HOME}/.local/bin"
		mkdir -p "$BIN_DIR"
		APPIMAGE_DEST="$BIN_DIR/$APP_NAME.AppImage"
		cp "$ARTIFACT" "$APPIMAGE_DEST"
		chmod +x "$APPIMAGE_DEST"
		APPLICATIONS="${HOME}/.local/share/applications"
		mkdir -p "$APPLICATIONS"
		DESKTOP="$APPLICATIONS/${APP_NAME}.desktop"
		cat >"$DESKTOP" <<DESKTOP
[Desktop Entry]
Name=$APP_NAME
Exec=$APPIMAGE_DEST %F
Icon=text-editor
Type=Application
Categories=Utility;TextEditor;
MimeType=text/markdown;
DESKTOP
		echo "Installed to $APPIMAGE_DEST. Run: $APPIMAGE_DEST"
		echo "Or from app menu (if \$HOME/.local/bin is in PATH): markalldown"
	fi
	;;
tarball)
	if [[ "$SYSTEM_INSTALL" == "true" ]]; then
		INSTALL_DIR="/usr/local/share/$APP_NAME"
		BIN_DIR="/usr/local/bin"
		sudo mkdir -p "$INSTALL_DIR"
		sudo tar -xzf "$ARTIFACT" -C "$INSTALL_DIR" --strip-components=1
		# Find executable (electron-builder uses product name or lowercase)
		EXEC=""
		for name in "$APP_NAME" "markalldown"; do
			if [[ -f "$INSTALL_DIR/$name" ]]; then
				EXEC="$INSTALL_DIR/$name"
				break
			fi
		done
		if [[ -z "$EXEC" ]]; then
			EXEC="$(find "$INSTALL_DIR" -maxdepth 1 -type f -executable -print -quit)"
		fi
		[[ -n "$EXEC" ]] && sudo ln -sf "$EXEC" "$BIN_DIR/markalldown" && sudo ln -sf "$EXEC" "$BIN_DIR/$APP_NAME"
		echo "Installed to $INSTALL_DIR. Run: markalldown or $APP_NAME"
	else
		INSTALL_BASE="${HOME}/.local/share"
		BIN_DIR="${HOME}/.local/bin"
		mkdir -p "$BIN_DIR" "$INSTALL_BASE"
		tar -xzf "$ARTIFACT" -C "$INSTALL_BASE"
		EXTRACTED="$(tar -tzf "$ARTIFACT" | head -1 | cut -d/ -f1)"
		INSTALL_DIR="$INSTALL_BASE/$EXTRACTED"
		EXEC=""
		for name in "$APP_NAME" "markalldown"; do
			if [[ -f "$INSTALL_DIR/$name" ]]; then
				EXEC="$INSTALL_DIR/$name"
				break
			fi
		done
		if [[ -z "$EXEC" ]]; then
			EXEC="$(find "$INSTALL_DIR" -maxdepth 1 -type f -executable -print -quit)"
		fi
		if [[ -n "$EXEC" ]]; then
			ln -sf "$EXEC" "$BIN_DIR/markalldown"
			ln -sf "$EXEC" "$BIN_DIR/$APP_NAME"
		fi
		echo "Installed to $INSTALL_DIR. Run: markalldown or $APP_NAME (if ~/.local/bin is in PATH)"
	fi
	;;
*)
	echo "Unsupported install type: $INSTALL_TYPE"
	exit 1
	;;
esac
