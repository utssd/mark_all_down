#!/usr/bin/env bash
# mad-capture-freeze.sh — one-shot evidence capture when MAD is frozen.
#
# Run this the moment you notice MAD is unresponsive. It collects, for every
# MAD-related pid:
#   - /proc snapshots (status, stat, wchan, cmdline, fd listing)
#   - per-thread wchan / stack / state
#   - gdb all-thread backtrace  (attaches, detaches — safe)
#   - gcore of the main renderer/browser processes
#   - dmesg and journalctl tails
#
# After this completes you can keep using or killing MAD as you like; the
# evidence is frozen on disk under ~/mad-freeze-watch/capture-<ts>/.
#
# Usage:   scripts/mad-capture-freeze.sh
# Or:      scripts/mad-capture-freeze.sh <pid1> <pid2> ...
#
# Requires: gdb, gcore (usually in gdb package). Won't fail if missing — it
# just skips those steps and notes it.

set -u

TS=$(date +%Y%m%d-%H%M%S)
OUT="${MAD_WATCH_DIR:-$HOME/mad-freeze-watch}/capture-$TS"
mkdir -p "$OUT"
LOG="$OUT/capture.log"

say() { printf '%s %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG" ; }

if [ "$#" -gt 0 ]; then
  PIDS=("$@")
else
  mapfile -t PIDS < <(pgrep -f -- 'MarkAllDown|markalldown' | sort -u)
fi

if [ "${#PIDS[@]}" -eq 0 ]; then
  say "no MAD pids found — nothing to capture"
  exit 1
fi

say "capturing pids: ${PIDS[*]}"
say "output dir: $OUT"

have_gdb=0
command -v gdb   >/dev/null 2>&1 && have_gdb=1
have_gcore=0
command -v gcore >/dev/null 2>&1 && have_gcore=1
[ $have_gdb   -eq 0 ] && say "WARN: gdb not installed — skipping backtraces"
[ $have_gcore -eq 0 ] && say "WARN: gcore not installed — skipping core dumps"

# System-wide stuff (once).
say "system: dmesg tail"
(dmesg -T 2>/dev/null || dmesg 2>/dev/null) | tail -n 500 > "$OUT/dmesg.txt" || true
say "system: journalctl tail"
journalctl -b --since '1 hour ago' 2>/dev/null | tail -n 2000 > "$OUT/journal.txt" || true
say "system: df -h /dev/shm"
{ df -h /dev/shm; ls -la /dev/shm 2>/dev/null | head -n 100; } > "$OUT/devshm.txt" || true
say "system: top snapshot"
top -b -n 1 -w 512 > "$OUT/top.txt" 2>/dev/null || true

for pid in "${PIDS[@]}"; do
  if [ ! -d "/proc/$pid" ]; then
    say "pid=$pid gone; skip"
    continue
  fi
  D="$OUT/pid$pid"
  mkdir -p "$D"
  say "pid=$pid: /proc snapshot"
  cp "/proc/$pid/status"  "$D/status"  2>/dev/null || true
  cp "/proc/$pid/stat"    "$D/stat"    2>/dev/null || true
  cp "/proc/$pid/wchan"   "$D/wchan"   2>/dev/null || true
  cp "/proc/$pid/cmdline" "$D/cmdline" 2>/dev/null || true
  cp "/proc/$pid/maps"    "$D/maps"    2>/dev/null || true
  cp "/proc/$pid/limits"  "$D/limits"  2>/dev/null || true
  ls -la "/proc/$pid/fd"  > "$D/fd-listing.txt" 2>/dev/null || true

  if [ -d "/proc/$pid/task" ]; then
    say "pid=$pid: per-thread wchan / state / stack"
    : > "$D/task-summary.txt"
    for tid in "/proc/$pid/task/"*; do
      tnum=$(basename "$tid")
      w=$(cat "$tid/wchan" 2>/dev/null)
      s=$(awk '/^State:/ {print $2$3}' "$tid/status" 2>/dev/null)
      printf 'tid=%s state=%s wchan=%s\n' "$tnum" "$s" "$w" >> "$D/task-summary.txt"
      # /proc/$tid/stack requires root or kptr_restrict; try anyway.
      if [ -r "$tid/stack" ]; then
        {
          printf '=== tid %s stack ===\n' "$tnum"
          cat "$tid/stack"
          printf '\n'
        } >> "$D/task-stacks.txt" 2>/dev/null || true
      fi
    done
  fi

  if [ $have_gdb -eq 1 ]; then
    say "pid=$pid: gdb thread apply all bt (30s timeout)"
    timeout 30 gdb -p "$pid" -batch \
      -ex 'set pagination off' \
      -ex 'thread apply all bt' \
      -ex 'detach' -ex 'quit' \
      > "$D/gdb-backtrace.txt" 2>&1 || say "pid=$pid: gdb timed out or failed"
  fi
done

# Core-dump only the main browser-process pids (too big otherwise).
# Heuristic: pids whose cmdline has no '--type=' are browser/main processes.
if [ $have_gcore -eq 1 ]; then
  for pid in "${PIDS[@]}"; do
    [ -d "/proc/$pid" ] || continue
    cmd=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)
    case "$cmd" in
      *--type=*) continue ;;      # renderer / zygote / gpu-process: skip
    esac
    say "pid=$pid: gcore (60s timeout)"
    ( cd "$OUT/pid$pid" && timeout 60 gcore -o core "$pid" ) \
      > "$OUT/pid$pid/gcore.log" 2>&1 \
      || say "pid=$pid: gcore timed out or failed"
  done
else
  say "gcore unavailable — no core dumps"
fi

say "done. Evidence in $OUT"
printf '\nTo tar this up:\n  tar czf %s.tgz -C %s %s\n' \
  "$OUT" "$(dirname "$OUT")" "$(basename "$OUT")"
