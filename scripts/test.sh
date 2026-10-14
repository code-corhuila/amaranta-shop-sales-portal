#!/usr/bin/env bash
# Everything the portal must pass, with Docker only (nothing is installed):
#
#   bash scripts/test.sh
#
# 1. the `test` stage of deploy/Dockerfile: `npm ci` from the versioned lock file, the strict type check and the test
#    suite. It is never taken from the cache, so a green run always means the tests ran just now;
# 2. the `build` stage: the remote with Module Federation, which must produce remoteEntry.js, and whose compiled code
#    must not contain the address of the gateway or handle a token (Annex H);
# It is the same script the pull request runs.
set -euo pipefail
cd "$(dirname "$0")/.."
# Git Bash on Windows must not rewrite the container paths given to docker.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }
docker build --progress=plain --no-cache-filter test --target test -f deploy/Dockerfile .
docker build --progress=plain --no-cache-filter build --target build -f deploy/Dockerfile .

echo "OK: the portal passes every check"
