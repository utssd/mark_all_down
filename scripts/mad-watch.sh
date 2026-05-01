#!/usr/bin/env bash
# mad-watch.sh — low-frequency health sampler for MarkAllDown.
#
# Runs forever. Every INTERVAL seconds, finds all MAD-related pids, writes
# one summary line per pid to ~/mad-freeze-watch/summary.log and a detail
# snapshot under ~/mad-freeze-watch/detail/<ts>/pid<pid>/ so that if MAD
# freezes overnight we have before/after samples of fd counts, /dev/shm
# usage, thread counts, and wchan.
#
# Start:  nohup scripts/mad-watch.sh >/dev/null 2>&1 &
# Stop:   pkill -f mad-watch.sh

set -u

OUT="${MAD_WATCH_DIR:-$HOME/mad-freeze-watch}"
INTERVAL="${MAD_WATCH_INTERVAL:-300}"   # 5 min
mkdir -p "$OUT/detail"
SUMMARY="$OUT/summary.log"

note() { printf '%s %s\n' "$(date -Iseconds)" "$*" >> "$SUMMARY"; }

note "mad-watch start interval=${INTERVAL}s out=$OUT"

while true; do
  TS=$(date +%Y%m%d-%H%M%S)
  mapfile -t PIDS < <(pgrep -f -- 'MarkAllDown|markalldown' | sort -u)
  if [ "${#PIDS[@]}" -eq 0 ]; then
    note "no-mad-pids"
  else
    for pid in "${PIDS[@]}"; do
      [ -d "/proc/$pid" ] || continue
      cmd=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | cut -c1-160)
      rss=$(awk '/^VmRSS:/  {print $2$3}'  "/proc/$pid/status" 2>/dev/null)
      thr=$(awk '/^Threads:/{print $2}'    "/proc/$pid/status" 2>/dev/null)
      state=$(awk '/^State:/ {print $2$3}' "/proc/$pid/status" 2>/dev/null)
      vctx=$(awk '/^voluntary_ctxt_switches:/    {print $2}' "/proc/$pid/status" 2>/dev/null)
      nctx=$(awk '/^nonvoluntary_ctxt_switches:/ {print $2}' "/proc/$pid/status" 2>/dev/null)
      fds=$(ls "/proc/$pid/fd" 2>/dev/null | wc -l)
      shmfd=$(ls -l "/proc/$pid/fd" 2>/dev/null | grep -c 'org.chromium.Chromium' || true)
      delfd=$(ls -l "/proc/$pid/fd" 2>/dev/null | grep -c '(deleted)'          || true)
      note "pid=$pid state=$state rss=$rss threads=$thr fds=$fds shm=$shmfd deleted=$delfd vctx=$vctx nctx=$nctx cmd='$cmd'"

      D="$OUT/detail/$TS/pid$pid"
      mkdir -p "$D"
      cp "/proc/$pid/status"  "$D/status"  2>/dev/null || true
      cp "/proc/$pid/wchan"   "$D/wchan"   2>/dev/null || true
      cp "/proc/$pid/cmdline" "$D/cmdline" 2>/dev/null || true
      ls -la "/proc/$pid/fd" > "$D/fd-listing.txt" 2>/dev/null || true
      # Per-thread wchan (cheap, non-intrusive)
      if [ -d "/proc/$pid/task" ]; then
        for tid in "/proc/$pid/task/"*; do
          tnum=$(basename "$tid")
          printf '%s ' "$tnum" >> "$D/task-wchan.txt"
          cat "$tid/wchan" 2>/dev/null >> "$D/task-wchan.txt"
          printf '\n' >> "$D/task-wchan.txt"
        done
      fi
    done
  fi

  # Keep only the last 48 detail dirs (~ 4 h at 5-min interval).
  ls -1dt "$OUT/detail/"* 2>/dev/null | tail -n +49 | xargs -r rm -rf

  # Rotate summary.log at 5 MB.
  if [ -f "$SUMMARY" ] && [ "$(stat -c%s "$SUMMARY")" -gt 5242880 ]; then
    mv "$SUMMARY" "$SUMMARY.1"
  fi

  sleep "$INTERVAL"
done
