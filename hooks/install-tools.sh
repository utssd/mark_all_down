#!/usr/bin/env bash
# install-tools.sh — shared helper: ensure formatting/linting tools are available.
# Sourced by pre-commit and format-all.sh; also callable directly via setup-hooks.sh.

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

_apt_install() {
	if command -v apt-get &>/dev/null; then
		sudo apt-get install -y "$@" 2>/dev/null || apt-get install -y "$@" 2>/dev/null || true
	fi
}

_brew_install() {
	if command -v brew &>/dev/null; then
		brew install "$@" 2>/dev/null || true
	fi
}

_pip_install() {
	if command -v pip3 &>/dev/null; then
		pip3 install --quiet "$@" || pip install --quiet "$@" 2>/dev/null || true
	elif command -v pip &>/dev/null; then
		pip install --quiet "$@" || true
	fi
}

ensure_prettier() {
	if [ -x "$REPO_ROOT/node_modules/.bin/prettier" ] || command -v prettier &>/dev/null; then
		return 0
	fi
	echo "[hooks] Installing prettier..."
	(cd "$REPO_ROOT" && npm install --save-dev prettier --no-fund --no-audit 2>/dev/null) || true
}

ensure_eslint() {
	if [ -x "$REPO_ROOT/node_modules/.bin/eslint" ] || command -v eslint &>/dev/null; then
		return 0
	fi
	echo "[hooks] Installing eslint..."
	(cd "$REPO_ROOT" && npm install --save-dev eslint --no-fund --no-audit 2>/dev/null) || true
}

ensure_black() {
	command -v black &>/dev/null && return 0
	echo "[hooks] Installing black..."
	_pip_install black
}

ensure_isort() {
	command -v isort &>/dev/null && return 0
	echo "[hooks] Installing isort..."
	_pip_install isort
}

ensure_ruff() {
	command -v ruff &>/dev/null && return 0
	echo "[hooks] Installing ruff..."
	_pip_install ruff
}

ensure_shfmt() {
	command -v shfmt &>/dev/null && return 0
	echo "[hooks] Installing shfmt..."
	if [[ "$(uname)" == "Darwin" ]]; then
		_brew_install shfmt
	else
		_apt_install shfmt
		# Fallback: download binary
		if ! command -v shfmt &>/dev/null; then
			local ver="v3.8.0"
			local arch
			arch="$(uname -m)"
			[[ "$arch" == "x86_64" ]] && arch="amd64"
			[[ "$arch" == "aarch64" ]] && arch="arm64"
			if curl -fsSL "https://github.com/mvdan/sh/releases/download/$ver/shfmt_${ver}_linux_${arch}" \
				-o /usr/local/bin/shfmt 2>/dev/null; then chmod +x /usr/local/bin/shfmt || true; fi
		fi
	fi
}

ensure_shellcheck() {
	command -v shellcheck &>/dev/null && return 0
	echo "[hooks] Installing shellcheck..."
	if [[ "$(uname)" == "Darwin" ]]; then
		_brew_install shellcheck
	else
		_apt_install shellcheck
	fi
}

install_all_tools() {
	ensure_prettier
	ensure_eslint
	ensure_black
	ensure_isort
	ensure_ruff
	ensure_shfmt
	ensure_shellcheck
}
