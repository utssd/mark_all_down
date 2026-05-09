#!/usr/bin/env bash
# Prints the build version to stdout.
#
# Resolution order:
#   1. GITHUB_REF=refs/tags/vX.Y.Z      -> X.Y.Z          (CI on tag push)
#   2. git describe --tags --match 'v*' -> X.Y.Z[-N-gSHA][-dirty]   (local)
#   3. no v* tags yet                   -> 0.0.0-dev+<short-sha>
set -euo pipefail

if [[ "${GITHUB_REF:-}" == refs/tags/v* ]]; then
	printf '%s\n' "${GITHUB_REF#refs/tags/v}"
	exit 0
fi

if described=$(git describe --tags --always --dirty --match 'v*' 2>/dev/null); then
	if [[ "$described" == v* ]]; then
		printf '%s\n' "${described#v}"
		exit 0
	fi
fi

sha=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
printf '0.0.0-dev+%s\n' "$sha"
