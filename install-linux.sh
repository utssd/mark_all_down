#!/usr/bin/env bash
# install-linux.sh — Build and install MarkAllDown on Linux.
#
# --rebuild notes:
#   This script is often invoked from inside MAD's own terminal (node-pty
#   child of the running Electron process). Two hard constraints follow:
#
#   1. MEMORY. `npm run build` (electron-builder + esbuild) peaks around
#      4–6 GB. If the old MAD instance is still alive during the build, the
#      combined RSS + gnome-shell + browser regularly trips the OOM killer,
#      which loves to pick gnome-shell / Xorg — logging the user out of
#      their desktop session. Therefore: kill the old MAD BEFORE building.
#
#   2. SESSION. Killing MAD also tears down its PTYs, which would SIGHUP
#      this script. Therefore: when --rebuild, re-exec ourselves under
#      `setsid nohup` first, so we live in a new session detached from
#      MAD's PTY, with output going to a log file the user can tail.
#
#   Control flow for --rebuild (post-detach):
#     stop old MAD  →  build  →  install  →  launch new MAD  (linear, no watcher)

set -euo pipefail

APP_NAME="MarkAllDown"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
REBUILD_LOG="/tmp/mad-rebuild.log"

DO_BUILD=false
DO_REBUILD=false
SYSTEM_INSTALL=false

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Install $APP_NAME on Linux from built artifacts in dist/.

Options:
  --build    Build the default AppImage artifact first, then install.
  --rebuild  Build + reinstall (user path only) + relaunch the running MAD.
             Safe to invoke from inside MAD's own terminal. Incompatible with --system.
             Detaches from the caller's terminal; progress: tail -f $REBUILD_LOG
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
	--rebuild)
		DO_BUILD=true
		DO_REBUILD=true
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

if [[ "$DO_REBUILD" == "true" && "$SYSTEM_INSTALL" == "true" ]]; then
	echo "--rebuild is not compatible with --system (user install only)." >&2
	exit 2
fi

if [[ "$(uname -s)" != "Linux" ]]; then
	echo "This script is for Linux only. Detected: $(uname -s)"
	exit 1
fi

# ── Detach phase ────────────────────────────────────────────────────────────
# For --rebuild, re-exec under setsid + nohup so we survive MAD's PTY dying
# when we kill it later. We pass intent via env vars (not argv) because
# nohup/setsid + argv re-propagation has historically been fragile across
# builds; env is dead simple and impossible to lose.
if [[ "$DO_REBUILD" == "true" && "${MAD_REBUILD_DETACHED:-0}" == "1" && -t 0 ]]; then
	# stdin is a tty → we're running from a user terminal, not our own
	# re-exec (which uses </dev/null). The sentinel env var has leaked,
	# likely from a MAD instance launched by a previous --rebuild. Scrub
	# it and fall through into the normal detach branch.
	echo "Warning: stale MAD_REBUILD_DETACHED=1 detected in shell env; ignoring." >&2
	unset MAD_REBUILD_DETACHED MAD_DO_BUILD MAD_DO_REBUILD
fi

if [[ "$DO_REBUILD" == "true" && "${MAD_REBUILD_DETACHED:-0}" != "1" ]]; then
	: >"$REBUILD_LOG"
	{
		echo "── MarkAllDown rebuild ──"
		date -Iseconds
		echo "caller argv: $*"
	} >>"$REBUILD_LOG"
	echo "Rebuild detached. Follow progress:  tail -f $REBUILD_LOG"
	MAD_REBUILD_DETACHED=1 \
		MAD_DO_BUILD=1 \
		MAD_DO_REBUILD=1 \
		setsid nohup bash "$0" </dev/null >>"$REBUILD_LOG" 2>&1 &
	disown 2>/dev/null || true
	exit 0
fi

# Honour flags passed via env from our own detach phase. Env beats argv here
# because (a) the re-exec carries no argv at all, and (b) it survives any
# shell/nohup quirks that might strip dashes from argv.
if [[ "${MAD_REBUILD_DETACHED:-0}" == "1" ]]; then
	[[ "${MAD_DO_BUILD:-0}" == "1" ]] && DO_BUILD=true
	[[ "${MAD_DO_REBUILD:-0}" == "1" ]] && DO_REBUILD=true
	echo "[detached] DO_BUILD=$DO_BUILD DO_REBUILD=$DO_REBUILD pid=$$ ppid=$PPID sid=$(ps -o sid= -p $$ | tr -d ' ') pgid=$(ps -o pgid= -p $$ | tr -d ' ')"
	trap 'echo "[diag] TRAP EXIT rc=$?"' EXIT
	trap 'echo "[diag] TRAP HUP"; exit 129' HUP
	trap 'echo "[diag] TRAP TERM"; exit 143' TERM
	trap 'echo "[diag] TRAP INT"; exit 130' INT
fi

# ── Shared helpers ──────────────────────────────────────────────────────────
# shellcheck source=./cleanup-stale-mad.sh
source "$SCRIPT_DIR/cleanup-stale-mad.sh"

# Resolve the outermost live MAD wrapper PIDs (processes matched by pattern
# whose parent is NOT itself a matched MAD process). Skips this shell and
# its parent so we don't target ourselves when invoked from MAD's terminal.
find_running_mad_pids() {
	local pids=() pid parent kept=()
	while IFS= read -r pid; do
		[[ -n "$pid" ]] && pids+=("$pid")
	done < <(pgrep -f -i "MarkAllDown\.AppImage|(^|/)markalldown( |$)" 2>/dev/null || true)
	echo "[diag] find_running_mad_pids: self=\$\$=$$ \$PPID=$PPID raw_pgrep=(${pids[*]})" >&2
	if ((${#pids[@]} > 0)); then
		echo "[diag] raw matches:" >&2
		ps -o pid,ppid,comm,args -p "${pids[@]}" 2>&1 | sed 's/^/[diag]   /' >&2 || true
	fi
	((${#pids[@]} == 0)) && { echo "[diag] find_running_mad_pids: pgrep found nothing" >&2; return 0; }
	declare -A in_set=()
	for pid in "${pids[@]}"; do in_set[$pid]=1; done
	for pid in "${pids[@]}"; do
		if [[ "$pid" == "$$" || "$pid" == "$PPID" ]]; then
			echo "[diag]   skip pid=$pid reason=self-or-parent" >&2
			continue
		fi
		parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
		if [[ -z "$parent" ]]; then
			echo "[diag]   skip pid=$pid reason=no-parent-readable" >&2
			continue
		fi
		if [[ -n "${in_set[$parent]:-}" ]]; then
			echo "[diag]   skip pid=$pid reason=parent-$parent-in-set" >&2
			continue
		fi
		echo "[diag]   keep pid=$pid parent=$parent" >&2
		kept+=("$pid")
		echo "$pid"
	done
	echo "[diag] find_running_mad_pids: kept=(${kept[*]})" >&2
	return 0
}

# Wait up to $2 seconds for $1 to exit. Returns 0 if it exited, 1 on timeout.
wait_for_exit() {
	local pid="$1" timeout="${2:-30}" deadline
	deadline=$(($(date +%s) + timeout))
	while kill -0 "$pid" 2>/dev/null; do
		(($(date +%s) >= deadline)) && return 1
		sleep 0.2
	done
	return 0
}

stop_running_mad() {
	local pids=() pid rc
	while IFS= read -r pid; do
		[[ -n "$pid" ]] && pids+=("$pid")
	done < <(find_running_mad_pids)
	if ((${#pids[@]} == 0)); then
		echo "[diag] stop_running_mad: no pids found, nothing to do"
		return 0
	fi

	echo "Stopping MarkAllDown (PIDs: ${pids[*]})..."
	for pid in "${pids[@]}"; do
		if kill -TERM "$pid" 2>/tmp/mad-rebuild.kill.err; then
			rc=0
		else
			rc=$?
		fi
		echo "[diag] kill -TERM $pid → rc=$rc stderr=$(tr -d '\n' </tmp/mad-rebuild.kill.err 2>/dev/null || true)"
	done
	for pid in "${pids[@]}"; do
		if ! wait_for_exit "$pid" 30; then
			echo "PID $pid still alive after 30s; SIGKILL."
			if kill -KILL "$pid" 2>/tmp/mad-rebuild.kill.err; then
				rc=0
			else
				rc=$?
			fi
			echo "[diag] kill -KILL $pid → rc=$rc stderr=$(tr -d '\n' </tmp/mad-rebuild.kill.err 2>/dev/null || true)"
			wait_for_exit "$pid" 5 || true
		fi
	done
	rm -f /tmp/mad-rebuild.kill.err
	cleanup_stale_mad_processes

	# Residual sweep: when we kill the outer AppImage wrapper, its Electron
	# helper processes (gpu-process, utility, zygote) get reparented to init
	# and survive. cleanup_stale_mad_processes only touches wrappers with no
	# children, so these slip through. Escalate directly to SIGKILL — they've
	# already been orphaned from their parent and are dead weight.
	local sweep residual=()
	for sweep in 1 2; do
		residual=()
		while IFS= read -r pid; do
			[[ -n "$pid" ]] && residual+=("$pid")
		done < <(find_running_mad_pids)
		((${#residual[@]} == 0)) && break
		echo "[diag] residual sweep $sweep: orphaned MAD pids still alive: ${residual[*]}; SIGKILL"
		for pid in "${residual[@]}"; do
			kill -KILL "$pid" 2>/dev/null || true
		done
		# Also kill any pgrep-matched MAD helpers (GPU/utility/zygote/broker)
		# that find_running_mad_pids filtered out because their parent was in
		# the set. With the wrapper already dead they're reparented to init.
		while IFS= read -r pid; do
			[[ -z "$pid" ]] && continue
			[[ "$pid" == "$$" || "$pid" == "$PPID" ]] && continue
			kill -KILL "$pid" 2>/dev/null || true
		done < <(pgrep -f -i "MarkAllDown\.AppImage|(^|/)markalldown( |$)" 2>/dev/null || true)
		sleep 1
	done
	if ((${#residual[@]} > 0)); then
		echo "[diag] FATAL: MAD still alive after SIGKILL sweeps: ${residual[*]}" >&2
		return 1
	fi
	echo "[diag] stop_running_mad: all targeted PIDs gone"
}

run_build() {
	echo "Building Linux AppImage..."
	if [[ ! -d "$SCRIPT_DIR/node_modules" ]] || ! (cd "$SCRIPT_DIR" && npm ls --depth=0 >/dev/null 2>&1); then
		echo "Installing dependencies with npm ci..."
		(cd "$SCRIPT_DIR" && npm ci --no-audit --no-fund)
	fi
	(cd "$SCRIPT_DIR" && npm run build)
}

find_artifact() {
	local ext="$1"
	find "$DIST_DIR" -maxdepth 1 -type f -name "*${ext}" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-
}

launch_detached() {
	local appimage="$1"
	local launch_log="/tmp/mad-launch.log"
	echo "[diag] launch_detached: appimage=$appimage launch_log=$launch_log"
	: >"$launch_log"
	# Scrub our own sentinel env vars so the new MAD does not carry them into
	# its child shells. Without this, the next --rebuild from inside the new
	# MAD's terminal sees MAD_REBUILD_DETACHED=1 already set, skips the detach
	# phase, runs inline, and dies when it kills its own PTY.
	env -u MAD_REBUILD_DETACHED -u MAD_DO_BUILD -u MAD_DO_REBUILD \
		setsid nohup "$appimage" </dev/null >>"$launch_log" 2>&1 &
	local child=$!
	disown 2>/dev/null || true
	echo "[diag] launch_detached: spawned pid=$child"
	sleep 2
	if kill -0 "$child" 2>/dev/null; then
		echo "[diag] launch_detached: pid=$child still alive after 2s"
	else
		echo "[diag] launch_detached: pid=$child exited within 2s; see $launch_log"
		if [[ -s "$launch_log" ]]; then
			echo "[diag] --- $launch_log ---"
			sed 's/^/[diag] /' "$launch_log"
			echo "[diag] --- end $launch_log ---"
		else
			echo "[diag] $launch_log is empty"
		fi
	fi
}

# ── Main flow ───────────────────────────────────────────────────────────────

# 1. Stop the old MAD FIRST when rebuilding, so the build has the RAM it
#    needs and the FUSE-mounted AppImage is released before we overwrite it.
#    Non-rebuild runs still clean up orphan wrappers as before.
if [[ "$DO_REBUILD" == "true" ]]; then
	stop_running_mad
else
	cleanup_stale_mad_processes
fi

# 2. Build.
if [[ "$DO_BUILD" == "true" ]]; then
	run_build
fi

# 3. Resolve version (informational only).
VERSION=""
if [[ -f "$SCRIPT_DIR/package.json" ]]; then
	VERSION="$(node -p "require('$SCRIPT_DIR/package.json').version" 2>/dev/null)" || true
fi
[[ -z "$VERSION" ]] && VERSION="unknown"

mkdir -p "$DIST_DIR"

# 4. Locate artifacts.
DEB="$(find_artifact .deb)"
APPIMAGE="$(find_artifact .AppImage)"
TARBALL="$(find_artifact .tar.gz)"

if [[ -z "$DEB" && -z "$APPIMAGE" && -z "$TARBALL" ]]; then
	echo "No Linux artifacts found in $DIST_DIR."
	echo "Run: npm run build:linux"
	echo "Or: $0 --build"
	exit 1
fi

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

# 5. Install.
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
		sudo rm -f "$APPIMAGE_DEST"
		sudo cp "$ARTIFACT" "$APPIMAGE_DEST"
		sudo chmod +x "$APPIMAGE_DEST"
		sudo ln -sf "$APPIMAGE_DEST" "$BIN_DIR/markalldown"
		sudo ln -sf "$APPIMAGE_DEST" "$BIN_DIR/$APP_NAME"
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
		rm -f "$APPIMAGE_DEST"
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

		# 6. Launch new MAD when rebuilding.
		if [[ "$DO_REBUILD" == "true" ]]; then
			echo "Launching new MarkAllDown..."
			launch_detached "$APPIMAGE_DEST"
		fi
	fi
	;;
tarball)
	if [[ "$SYSTEM_INSTALL" == "true" ]]; then
		INSTALL_DIR="/usr/local/share/$APP_NAME"
		BIN_DIR="/usr/local/bin"
		sudo mkdir -p "$INSTALL_DIR"
		sudo tar -xzf "$ARTIFACT" -C "$INSTALL_DIR" --strip-components=1
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
