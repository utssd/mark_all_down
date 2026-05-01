#!/usr/bin/env bash
# Test: cleanup_stale_mad_processes kills orphans (no children) but spares
# currently-running instances (processes that own a child). Runs Linux-only.

set -uo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
	echo "skipping cleanup-stale-mad tests on $(uname -s)"
	exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../cleanup-stale-mad.sh
source "$ROOT/cleanup-stale-mad.sh"

# Point the mount glob at a path that cannot exist so the unmount loop is a
# no-op during tests (we're only testing the process-kill half here).
export MAD_CLEANUP_MOUNT_GLOB="/tmp/.cleanup-mad-test-nonexistent-$$"

# A unique argv[0] tag so we don't accidentally touch real MarkAllDown processes.
TAG="mad-cleanup-test-$$-$RANDOM"

PASS=0
FAIL=0

report() {
	if [[ "$1" == "ok" ]]; then
		echo "  ok - $2"
		PASS=$((PASS + 1))
	else
		echo "  fail - $2"
		FAIL=$((FAIL + 1))
	fi
}

cleanup_on_exit() {
	pkill -KILL -f "$TAG" 2>/dev/null || true
}
trap cleanup_on_exit EXIT

# ── Setup ───────────────────────────────────────────────────────────────────

# Orphan: a single sleep process whose argv[0] contains the tag. No children.
bash -c "exec -a '${TAG}-orphan' sleep 60" &
ORPHAN_PID=$!

# Non-orphan: a bash process whose argv[0] contains the tag, AND it owns an
# inner sleep child. Cleanup should skip this because it has a direct child.
bash -c "exec -a '${TAG}-parent' bash -c 'sleep 120 & wait'" &
PARENT_PID=$!

# Unrelated: no tag in argv[0]. Cleanup must never touch this.
bash -c "exec -a 'unrelated-${TAG}-NOT-PATTERN' sleep 60" &
UNRELATED_PID=$!

# Give the exec a moment to land
sleep 0.4

# Sanity: orphan and parent should both show up under the tag.
TAGGED_BEFORE=$(pgrep -f "$TAG" | sort | tr '\n' ' ')
echo "tagged before cleanup: $TAGGED_BEFORE"

# ── Run the function under test ─────────────────────────────────────────────

# Use just the tag (not with -orphan/-parent suffix) so pgrep matches both.
# The unrelated process has the tag as a substring too, but pgrep -f would
# match it as well — we'll rely on pgrep pattern NOT matching the unrelated
# one. Let's use a pattern that only matches "-orphan" and "-parent":
MATCH="${TAG}-(orphan|parent)"

# cleanup_stale_mad_processes takes a plain string, passed to pgrep -f which
# treats it as a regex — but our function passes it unquoted. Verify it
# handles a regex-ish pattern correctly.
cleanup_stale_mad_processes "$MATCH" >/dev/null 2>&1

# Give SIGTERM + the function's internal sleep a moment to settle
sleep 0.3

# ── Assertions ──────────────────────────────────────────────────────────────

if ! kill -0 "$ORPHAN_PID" 2>/dev/null; then
	report ok "orphan (no children) was killed"
else
	report fail "orphan survived (pid $ORPHAN_PID)"
fi

if kill -0 "$PARENT_PID" 2>/dev/null; then
	report ok "non-orphan (owns a child) was spared"
else
	report fail "non-orphan was killed (pid $PARENT_PID)"
fi

if kill -0 "$UNRELATED_PID" 2>/dev/null; then
	report ok "process not matching pattern was untouched"
else
	report fail "process not matching pattern was killed (pid $UNRELATED_PID)"
fi

# ── Double-invocation safety (idempotent) ──────────────────────────────────

# Running cleanup again with no orphans must not error and must not kill the
# still-alive parent.
cleanup_stale_mad_processes "$MATCH" >/dev/null 2>&1
sleep 0.1
if kill -0 "$PARENT_PID" 2>/dev/null; then
	report ok "idempotent second call did not kill surviving parent"
else
	report fail "second call killed the surviving parent"
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
