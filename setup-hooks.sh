#!/usr/bin/env bash
# setup-hooks.sh — one-time setup: install git hooks + all formatter/linter tools,
#                  then format every file in the project.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_SRC="$REPO_ROOT/hooks"
HOOKS_DEST="$REPO_ROOT/.git/hooks"

echo "==> Installing git hooks"
for hook in pre-commit commit-msg; do
	chmod +x "$HOOKS_SRC/$hook"
	ln -sf "$HOOKS_SRC/$hook" "$HOOKS_DEST/$hook"
	echo "    $hook -> $HOOKS_SRC/$hook"
done

echo ""
echo "==> Installing tools"
# shellcheck source=hooks/install-tools.sh
# shellcheck disable=SC1091
source "$HOOKS_SRC/install-tools.sh"
install_all_tools

echo ""
echo "==> npm install (ensures prettier + eslint in node_modules)"
(cd "$REPO_ROOT" && npm install --no-fund --no-audit 2>/dev/null) || true

echo ""
echo "==> Formatting all project files"
bash "$HOOKS_SRC/format-all.sh"

echo ""
echo "All done.  Hooks active, tools installed, files formatted."
