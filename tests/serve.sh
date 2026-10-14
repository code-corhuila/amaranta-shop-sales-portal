#!/usr/bin/env sh
# What the container that serves the portal must do (Annex H, rule 4). Run INSIDE the test network by scripts/test.sh,
# against the real image: sh tests/serve.sh http://portal:4202
set -u
BASE="${1:-http://portal:4202}"
SHELL_ORIGIN='Origin: http://localhost:4200'
fail=0

check() {  # description, expected status, curl arguments...
  desc="$1"; want="$2"; shift 2
  got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then echo "  ok    $desc ($got)"; else echo "  FAIL  $desc: want $want, got $got"; fail=1; fi
}
contains() {  # description, expected text, curl arguments...
  desc="$1"; want="$2"; shift 2
  if curl -s -i "$@" | grep -qi -- "$want"; then echo "  ok    $desc"; else echo "  FAIL  $desc: missing $want"; fail=1; fi
}
absent() {  # description, forbidden text, curl arguments...
  desc="$1"; bad="$2"; shift 2
  if curl -s -i "$@" | grep -qi -- "$bad"; then echo "  FAIL  $desc: found $bad"; fail=1; else echo "  ok    $desc"; fi
}

echo "the remote"
check    "the health probe answers"                                  200 "$BASE/health"
check    "remoteEntry.js answers"                                    200 "$BASE/remoteEntry.js"
check    "a remote has no page of its own: the root is a 404"        404 "$BASE/"

echo "what must never be cached (Annex H, rule 4)"
contains "remoteEntry.js is never cached"                            'Cache-Control: no-store' "$BASE/remoteEntry.js"

echo "what can be cached for good"
asset=$(curl -s "$BASE/remoteEntry.js" | grep -oE 'assets/[A-Za-z0-9_.-]+\.js' | head -1)
if [ -z "$asset" ]; then echo "  FAIL  remoteEntry.js names no script under assets/"; fail=1; else
  check    "a hashed file answers"                                   200 "$BASE/$asset"
  contains "...and is cached for a year, immutable"                  'Cache-Control: public, max-age=31536000, immutable' "$BASE/$asset"
  contains "...and the shell may load it from its own origin"        'Access-Control-Allow-Origin: http://localhost:4200' -H "$SHELL_ORIGIN" "$BASE/$asset"
fi
check    "a file that does not exist is a 404"                       404 "$BASE/assets/does-not-exist.js"

echo "who may load this portal from another origin (only the shell)"
contains "the shell may read remoteEntry.js"                         'Access-Control-Allow-Origin: http://localhost:4200' -H "$SHELL_ORIGIN" "$BASE/remoteEntry.js"
absent   "an unknown origin may not"                                 'Access-Control-Allow-Origin: http' -H 'Origin: http://evil.example' "$BASE/remoteEntry.js"
absent   "the other portal may not either"                            'Access-Control-Allow-Origin: http' -H 'Origin: http://localhost:4201' "$BASE/remoteEntry.js"

echo "headers"
contains "responses are not sniffed"                                 'X-Content-Type-Options: nosniff' "$BASE/remoteEntry.js"
absent   "the server does not say which nginx it is"                 'nginx/' "$BASE/remoteEntry.js"

exit $fail
