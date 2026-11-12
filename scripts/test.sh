#!/usr/bin/env bash
# Everything the portal must pass, with Docker only (nothing is installed):
#
#   bash scripts/test.sh
#
# 1. the `test` stage of deploy/Dockerfile: `npm ci` from the versioned lock file, the strict type check and the test
#    suite. It is never taken from the cache, so a green run always means the tests ran just now;
# 2. the `build` stage: the remote with Module Federation, which must produce remoteEntry.js, and whose compiled code
#    must not contain the address of the gateway or handle a token (Annex H);
# 3. the final image, started, and tests/serve.sh against it: the cache rules and who may load it.
# It is the same script the pull request runs.
set -euo pipefail
cd "$(dirname "$0")/.."
# Git Bash on Windows must not rewrite the container paths given to docker.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }
docker build --progress=plain --no-cache-filter test --target test -f deploy/Dockerfile .
docker build --progress=plain --no-cache-filter build --target build -f deploy/Dockerfile .

echo "== the final image serves the remote as Annex H requires"
ID=$$
NET="portal-test-net-$ID"
NAME="portal-test-$ID"
HERE="$(pwd -W 2> /dev/null || pwd)"
cleanup() { docker rm -f "$NAME" > /dev/null 2>&1 || true; docker network rm "$NET" > /dev/null 2>&1 || true; }
trap cleanup EXIT
docker build -q -f deploy/Dockerfile -t sales-portal:test . > /dev/null
docker network create "$NET" > /dev/null
docker run -d --name "$NAME" --network "$NET" --network-alias portal sales-portal:test > /dev/null
curl_in_network() { docker run --rm --network "$NET" -v "$HERE/tests:/tests:ro" --entrypoint sh curlimages/curl:latest "$@"; }
for _ in $(seq 1 30); do curl_in_network -c 'curl -sf http://portal:4202/health > /dev/null' && break; sleep 1; done
curl_in_network /tests/serve.sh http://portal:4202

echo "OK: the portal passes every check"
