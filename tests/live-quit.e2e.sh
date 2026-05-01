#!/usr/bin/env bash
# Live end-to-end test: launch + quit MAD repeatedly, assert gnome-shell
# survives every cycle with the same PID.
#
# Protects against the "quit-crashes-desktop" class of bug. Requires a
# running GNOME session and the packaged AppImage at dist/.
#
# Usage:
#   bash tests/live-quit.e2e.sh [cycles]
#
# Exits 0 on success. Exits non-zero (and leaves tests/live-quit.log)
# if gnome-shell's PID changes or goes missing during the run.

set -u

CYCLES="${1:-5}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPIMAGE="$(ls -1 "$REPO_ROOT/dist"/MarkAllDown-*.AppImage 2>/dev/null | head -1)"
LOG="$REPO_ROOT/tests/live-quit.log"

if [ -z "$APPIMAGE" ]; then
  echo "FAIL: no AppImage at $REPO_ROOT/dist/MarkAllDown-*.AppImage — run 'npm run build' first" >&2
  exit 2
fi

if ! pgrep -u "$UID" -x gnome-shell >/dev/null 2>&1; then
  echo "SKIP: no gnome-shell running for this user ($UID)" >&2
  exit 77
fi

GSHELL_BEFORE="$(pgrep -u "$UID" -x gnome-shell | head -1)"
GSHELL_RSS_BEFORE="$(ps -o rss= -p "$GSHELL_BEFORE" | tr -d ' ')"
MOUNTS_BEFORE="$(mount | grep -c '/tmp/.mount_' || true)"

echo "live-quit.e2e: AppImage=$APPIMAGE" | tee "$LOG"
echo "live-quit.e2e: gnome-shell pid=$GSHELL_BEFORE rss=${GSHELL_RSS_BEFORE}kB mounts=$MOUNTS_BEFORE cycles=$CYCLES" | tee -a "$LOG"

failures=0

for i in $(seq 1 "$CYCLES"); do
  echo "--- cycle $i/$CYCLES ---" | tee -a "$LOG"

  # Launch detached, capture its own PID so we can signal it if needed.
  "$APPIMAGE" --no-sandbox >>"$LOG" 2>&1 &
  MAD_PID=$!
  echo "cycle $i: launched MAD pid=$MAD_PID" | tee -a "$LOG"

  # Wait for the window to settle. MAD's Electron main needs ~1-3s on first
  # start (FUSE mount + v8 cold start).
  sleep 4

  # Quit via SIGTERM to the main process. This exercises Electron's
  # before-quit → will-quit path, which is where our fix lives.
  if kill -0 "$MAD_PID" 2>/dev/null; then
    kill -TERM "$MAD_PID" 2>/dev/null || true
  fi

  # Wait up to 10s for graceful exit.
  for _ in $(seq 1 20); do
    if ! kill -0 "$MAD_PID" 2>/dev/null; then break; fi
    sleep 0.5
  done
  if kill -0 "$MAD_PID" 2>/dev/null; then
    echo "cycle $i: MAD didn't exit after 10s, SIGKILL" | tee -a "$LOG"
    kill -KILL "$MAD_PID" 2>/dev/null || true
    sleep 1
  fi

  # Check gnome-shell didn't die or restart.
  GSHELL_NOW="$(pgrep -u "$UID" -x gnome-shell | head -1)"
  if [ -z "$GSHELL_NOW" ]; then
    echo "FAIL cycle $i: gnome-shell has disappeared" | tee -a "$LOG"
    failures=$((failures+1))
  elif [ "$GSHELL_NOW" != "$GSHELL_BEFORE" ]; then
    echo "FAIL cycle $i: gnome-shell restarted (was $GSHELL_BEFORE, now $GSHELL_NOW)" | tee -a "$LOG"
    failures=$((failures+1))
    GSHELL_BEFORE="$GSHELL_NOW"
  else
    RSS_NOW="$(ps -o rss= -p "$GSHELL_NOW" | tr -d ' ')"
    echo "cycle $i: OK gnome-shell pid=$GSHELL_NOW rss=${RSS_NOW}kB" | tee -a "$LOG"
  fi
done

# Final accounting.
GSHELL_RSS_AFTER="$(ps -o rss= -p "$GSHELL_BEFORE" 2>/dev/null | tr -d ' ' || echo 0)"
MOUNTS_AFTER="$(mount | grep -c '/tmp/.mount_' || true)"
RSS_DELTA=$((GSHELL_RSS_AFTER - GSHELL_RSS_BEFORE))
echo "---" | tee -a "$LOG"
echo "summary: gnome-shell rss before=${GSHELL_RSS_BEFORE}kB after=${GSHELL_RSS_AFTER}kB delta=${RSS_DELTA}kB" | tee -a "$LOG"
echo "summary: leftover /tmp/.mount_* mounts=$MOUNTS_AFTER (expected 0)" | tee -a "$LOG"

if [ "$failures" -gt 0 ]; then
  echo "live-quit.e2e: FAILED ($failures cycle(s) affected gnome-shell)" | tee -a "$LOG"
  exit 1
fi
if [ "$MOUNTS_AFTER" -gt "$MOUNTS_BEFORE" ]; then
  echo "live-quit.e2e: WARN leaked FUSE mounts: before=$MOUNTS_BEFORE after=$MOUNTS_AFTER" | tee -a "$LOG"
fi
echo "live-quit.e2e: PASS" | tee -a "$LOG"
exit 0
