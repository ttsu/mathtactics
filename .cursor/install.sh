#!/usr/bin/env bash
# Idempotent dependency setup for the Math vs. Robots Cloud Agent environment.
# Runs after the repository is checked out. Must terminate and be safe to re-run.
set -euo pipefail

# This project pins Node 24 (.nvmrc / package.json "engines"). The base image
# exposes an older Node ahead of nvm on PATH, so activate Node 24 explicitly and
# put its bin directory first before installing dependencies.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

nvm install 24 >/dev/null
node24_bin="$(dirname "$(nvm which 24)")"
export PATH="$node24_bin:$PATH"
hash -r

echo "Using Node $(node --version) / npm $(npm --version)"

npm ci
