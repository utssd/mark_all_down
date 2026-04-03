#!/usr/bin/env bash
# format-all.sh — run all formatters on every tracked file in the project.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=hooks/install-tools.sh
# shellcheck disable=SC1091
source "$REPO_ROOT/hooks/install-tools.sh"

cd "$REPO_ROOT" || exit

PRETTIER_BIN="$REPO_ROOT/node_modules/.bin/prettier"
command -v prettier &>/dev/null && PRETTIER_BIN="prettier"

echo "==> JS / HTML / CSS / JSON / YAML / Markdown (prettier)"
ensure_prettier
find . \
	\( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \
	-o -name "*.html" -o -name "*.css" -o -name "*.scss" \
	-o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \
	-o -name "*.md" -o -name "*.mdx" \) \
	-not -path "./node_modules/*" \
	-not -path "./dist/*" \
	-not -path "./.git/*" |
	sort |
	xargs "$PRETTIER_BIN" --write 2>/dev/null

echo "==> Python (black + isort)"
PY_FILES=$(find . -name "*.py" \
	-not -path "./node_modules/*" \
	-not -path "./dist/*" \
	-not -path "./.git/*")
if [[ -n "$PY_FILES" ]]; then
	ensure_black
	ensure_isort
	if command -v black &>/dev/null; then echo "$PY_FILES" | xargs black 2>/dev/null || true; fi
	if command -v isort &>/dev/null; then echo "$PY_FILES" | xargs isort 2>/dev/null || true; fi
fi

echo "==> Shell scripts (shfmt)"
SH_FILES=$(find . \( -name "*.sh" -o -name "*.bash" \) \
	-not -path "./node_modules/*" \
	-not -path "./dist/*" \
	-not -path "./.git/*")
if [[ -n "$SH_FILES" ]]; then
	ensure_shfmt
	if command -v shfmt &>/dev/null; then echo "$SH_FILES" | xargs shfmt -w 2>/dev/null || true; fi
fi

echo "Done."
