#!/usr/bin/env bash
# Long-running Vite dev server for the Math vs. Robots game.
# Served at http://localhost:5173 with the test handle enabled.
set -euo pipefail

# Match the Node version pinned by the project (see install.sh for context).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

nvm install 24 >/dev/null
node24_bin="$(dirname "$(nvm which 24)")"
export PATH="$node24_bin:$PATH"
hash -r

exec npm run dev -- --host
