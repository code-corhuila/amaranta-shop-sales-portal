#!/usr/bin/env bash
# The whole system, REAL, with Docker only: PostgreSQL and the structure of sales-db (Flyway), MongoDB and the ten products of
# catalog-db (Liquibase), sales-api, catalog-api, the gateway, the shell and the two portals. Nothing in it is a double.
#
#   bash scripts/e2e-real-stack.sh up              builds and starts everything, then prints the address to open
#   bash scripts/e2e-real-stack.sh check           asserts, over HTTP, what the whole chain must do (once per `up`: it buys)
#   bash scripts/e2e-real-stack.sh clock <ISO>     restarts sales-api with the shop's clock at that instant, e.g. a Sunday
#   bash scripts/e2e-real-stack.sh down            removes everything it created, the keys and the tokens included
#
# It needs the other repositories next to this one, or their paths in SALES_DB_DIR, SALES_API_DIR, CATALOG_DB_DIR, CATALOG_API_DIR,
# GATEWAY_DIR, FRONT_DIR and CATALOG_PORTAL_DIR, checked out at the code to run. Only the PUBLIC half of a throwaway signing key
# reaches the services; the key and two test tokens (ADMIN and CUSTOMER) stay in .stack/, which git ignores, and `down` deletes it.
set -euo pipefail
cd "$(dirname "$0")/.."
# Git Bash on Windows must not rewrite the container paths given to docker, but openssl (a Windows program) does need
# its own paths converted: so the switch is set for docker only.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }

NET=amaranta-real-stack
PG=real-postgres; MONGO=real-mongo; SALES=real-sales-api; CATALOG=real-catalog-api; GATEWAY=real-gateway
SHELL_C=real-shell; CATALOG_PORTAL=real-catalog-portal; SALES_PORTAL=real-sales-portal
STATE=.stack
ADMIN=amaranta_admin
FOOD=399d2ea8-1ccb-4193-8255-1b51e331984d   # FOOD-001 Croquetas Adulto Salmon 15kg: the id the monolith issued, 24 units, 189000 pesos
OPEN_CLOCK=2026-10-12T15:00:00Z             # a Monday, 10:00 in Bogota: the shop is open (Mon-Sat 08-12 and 14-18)

sibling() { # sibling <VAR> <default relative path>: the directory as docker wants it, or stop
  local path="${!1:-$2}"
  ( cd "$path" 2> /dev/null && { pwd -W 2> /dev/null || pwd; } ) || { echo "$1 not found: clone it next to this repository or set $1" >&2; exit 1; }
}

down() {
  docker rm -f "$PG" "$MONGO" "$SALES" "$CATALOG" "$GATEWAY" "$SHELL_C" "$CATALOG_PORTAL" "$SALES_PORTAL" > /dev/null 2>&1 || true
  docker network rm "$NET" > /dev/null 2>&1 || true
  # The images carry the tag :real, so building over an existing one would fail ("already exists") on Docker Desktop.
  docker rmi catalog-db-liquibase:real catalog-api:real sales-api:real api-gateway:real shell:real catalog-portal:real sales-portal:real > /dev/null 2>&1 || true
  rm -rf "$STATE"
}

start_sales_api() { # start_sales_api <clock>: the shop's clock is fixed so that the shop is open (or closed) when the test says
  docker rm -f "$SALES" > /dev/null 2>&1 || true
  # shellcheck disable=SC1091
  . "$STATE/env"
  docker run -d --name "$SALES" --network "$NET" --network-alias sales-api \
    -e DATABASE_URL=jdbc:postgresql://postgres:5432/amaranta -e DATABASE_USER=sales_app -e DATABASE_PASSWORD="$SALES_PW" \
    -e "JWT_PUBLIC_KEY=$PUBLIC" -e CATALOG_API_URL=http://catalog-api:8082 -e "CLOCK_FIXED_AT=$1" sales-api:real > /dev/null
  for _ in $(seq 1 90); do [ "$(http_code http://sales-api:8080/health)" = "200" ] && return 0; sleep 1; done
  echo "FAIL: sales-api did not come up" >&2; docker logs --tail 20 "$SALES" >&2; return 1
}

up() {
  down
  local SALES_DB SALES_API CATALOG_DB CATALOG_API GW FRONT CATALOG_PORTAL_SRC
  SALES_DB="$(sibling SALES_DB_DIR ../amaranta-shop-sales-db)"
  SALES_API="$(sibling SALES_API_DIR ../amaranta-shop-sales-api)"
  CATALOG_DB="$(sibling CATALOG_DB_DIR ../amaranta-shop-catalog-db)"
  CATALOG_API="$(sibling CATALOG_API_DIR ../amaranta-shop-catalog-api)"
  GW="$(sibling GATEWAY_DIR ../amaranta-shop-api-gateway)"
  FRONT="$(sibling FRONT_DIR ../amaranta-shop-front)"
  CATALOG_PORTAL_SRC="$(sibling CATALOG_PORTAL_DIR ../amaranta-shop-catalog-portal)"
  mkdir -p "$STATE"

  echo "== a signing key (only the public half goes to the services) and two test tokens"
  openssl genrsa -out "$STATE/private.pem" 2048 2> /dev/null
  local PUBLIC PW SALES_PW CATALOG_PW
  PUBLIC="$(openssl rsa -in "$STATE/private.pem" -pubout 2> /dev/null | awk '{printf "%s\\n", $0}')"
  PW="$(openssl rand -hex 16)"; SALES_PW="$(openssl rand -hex 16)"; CATALOG_PW="$(openssl rand -hex 16)"
  printf 'PUBLIC=%q\nSALES_PW=%q\n' "$PUBLIC" "$SALES_PW" > "$STATE/env"
  b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  token() { # token <role>: a valid RS256 token, expiring in 2030
    local head body sig
    head="$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)"
    body="$(printf '{"sub":"33333333-3333-4333-8333-333333333333","role":"%s","exp":1893456000}' "$1" | b64url)"
    sig="$(printf '%s.%s' "$head" "$body" | openssl dgst -sha256 -sign "$STATE/private.pem" | b64url)"
    echo "$head.$body.$sig"
  }
  token ADMIN > "$STATE/admin.token"; token CUSTOMER > "$STATE/customer.token"

  echo "== the databases: PostgreSQL (sales-db) and MongoDB (catalog-db)"
  docker network create "$NET" > /dev/null
  # --tmpfs: both images declare their data directory as a volume, and without it every run would leave an anonymous volume.
  docker run -d --name "$PG" --network "$NET" --network-alias postgres --tmpfs /var/lib/postgresql/data -e POSTGRES_DB=amaranta \
    -e POSTGRES_USER="$ADMIN" -e POSTGRES_PASSWORD="$PW" postgres:16-alpine > /dev/null
  docker run -d --name "$MONGO" --network "$NET" --network-alias mongo --tmpfs /data/db -e MONGO_INITDB_ROOT_USERNAME="$ADMIN" \
    -e MONGO_INITDB_ROOT_PASSWORD="$PW" mongo:7.0 > /dev/null
  until docker exec "$PG" pg_isready -h 127.0.0.1 -U "$ADMIN" -d amaranta > /dev/null 2>&1; do sleep 1; done
  until docker logs "$MONGO" 2>&1 | grep -q "MongoDB init process complete"; do sleep 1; done
  mongo_admin() { docker exec -i "$MONGO" mongosh --quiet -u "$ADMIN" -p "$PW" --authenticationDatabase admin --eval "$1"; }
  psql_admin() { docker exec "$PG" psql -tA -q -v ON_ERROR_STOP=1 -U "$ADMIN" -d amaranta -c "$1"; }
  until mongo_admin "db.adminCommand('ping').ok" 2> /dev/null | grep -qx 1; do sleep 1; done
  psql_admin "CREATE ROLE sales_app LOGIN PASSWORD '$SALES_PW'" > /dev/null
  psql_admin "ALTER ROLE sales_app SET search_path = sales" > /dev/null
  mongo_admin "db.getSiblingDB('catalog').createUser({ user: 'catalog_app', pwd: '$CATALOG_PW', roles: [{ role: 'readWrite', db: 'catalog' }] })" > /dev/null
  docker run --rm --network "container:$PG" -v "$SALES_DB:/workspace:ro" -e FLYWAY_URL=jdbc:postgresql://localhost:5432/amaranta \
    -e FLYWAY_USER="$ADMIN" -e FLYWAY_PASSWORD="$PW" flyway/flyway:11.20 -workingDirectory=/workspace -configFiles=flyway.toml migrate | grep -E "Successfully applied|ERROR" || true
  docker build -q -t catalog-db-liquibase:real -f "$CATALOG_DB/deploy/liquibase.Dockerfile" "$CATALOG_DB/deploy" > /dev/null
  docker run --rm --network "$NET" -v "$CATALOG_DB:/workspace:ro" -e LIQUIBASE_COMMAND_USERNAME="$ADMIN" -e LIQUIBASE_COMMAND_PASSWORD="$PW" \
    --entrypoint liquibase catalog-db-liquibase:real --search-path=/workspace --changelog-file=changelog/changelog-master.yaml \
    --database-changelog-table-name=databasechangelog_catalog --database-changelog-lock-table-name=databasechangeloglock_catalog \
    --url="mongodb://mongo:27017/catalog?authSource=admin" update 2>&1 | grep -E "^Run:|ERROR|rror:" || true

  echo "== the services and the interface (their container images)"
  docker build -q -f "$SALES_API/deploy/Dockerfile" -t sales-api:real "$SALES_API" > /dev/null
  docker build -q -f "$CATALOG_API/deploy/Dockerfile" -t catalog-api:real "$CATALOG_API" > /dev/null
  docker build -q -f "$GW/deploy/Dockerfile" -t api-gateway:real "$GW" > /dev/null
  docker build -q -f "$FRONT/deploy/Dockerfile" -t shell:real "$FRONT" > /dev/null
  docker build -q -f "$CATALOG_PORTAL_SRC/deploy/Dockerfile" -t catalog-portal:real "$CATALOG_PORTAL_SRC" > /dev/null
  docker build -q -f deploy/Dockerfile -t sales-portal:real . > /dev/null
  docker run -d --name "$CATALOG" --network "$NET" --network-alias catalog-api \
    -e "MONGODB_URI=mongodb://catalog_app:$CATALOG_PW@mongo:27017/catalog?authSource=catalog" -e "JWT_PUBLIC_KEY=$PUBLIC" catalog-api:real > /dev/null
  docker run -d --name "$GATEWAY" --network "$NET" --network-alias gateway -p 8000:8000 api-gateway:real > /dev/null
  docker run -d --name "$CATALOG_PORTAL" --network "$NET" --network-alias catalog-portal -p 4201:4201 catalog-portal:real > /dev/null
  docker run -d --name "$SALES_PORTAL" --network "$NET" --network-alias sales-portal -p 4202:4202 sales-portal:real > /dev/null
  docker run -d --name "$SHELL_C" --network "$NET" --network-alias shell -p 4200:4200 shell:real > /dev/null
  start_sales_api "$OPEN_CLOCK"

  for _ in $(seq 1 60); do [ "$(http_code http://gateway:8000/api/v1/products)" = "200" ] && break; sleep 1; done
  [ "$(http_code http://gateway:8000/api/v1/products)" = "200" ] || { echo "FAIL: the chain did not come up" >&2; docker logs --tail 20 "$CATALOG" >&2; exit 1; }
  echo
  echo "UP. Open the shell:   http://localhost:4200/catalog        (the shop's clock: $OPEN_CLOCK, open)"
  echo "    the gateway:      http://localhost:8000/api/v1/products"
  echo "    test tokens:      $STATE/admin.token and $STATE/customer.token (put one in sessionStorage['amaranta.session'])"
  echo "    shop closed:      bash scripts/e2e-real-stack.sh clock 2026-10-11T15:00:00Z   (a Sunday)"
  echo "    stop and clean:   bash scripts/e2e-real-stack.sh down"
}

curl_net() { docker run --rm --network "$NET" curlimages/curl:latest -s "$@"; }
http_code() { curl_net -o /dev/null -w '%{http_code}' "$@" 2> /dev/null || true; }

fail=0
ok()   { echo "  ok    $1"; }
bad()  { echo "  FAIL  $1"; fail=1; }
expect_code() { # description, expected code, curl arguments...
  local desc="$1" want="$2"; shift 2
  local got; got="$(http_code "$@")"
  if [ "$got" = "$want" ]; then ok "$desc ($got)"; else bad "$desc: want $want, got $got"; fi
}
expect_body() { # description, grep pattern, curl arguments...
  local desc="$1" pattern="$2"; shift 2
  if curl_net "$@" | grep -qE -- "$pattern"; then ok "$desc"; else bad "$desc: missing $pattern"; fi
}

check() {
  [ -f "$STATE/admin.token" ] || { echo "the stack is not up: run 'up' first" >&2; exit 1; }
  local CUSTOMER_T G=http://gateway:8000
  CUSTOMER_T="$(cat "$STATE/customer.token")"
  local JSON=(-H 'Content-Type: application/json')
  local BODY='{"items":[{"productId":"'"$FOOD"'","quantity":2}],"fulfillmentMethod":"PICKUP","paymentMethod":"CASH","contactName":"Ana Torres","contactPhone":"3001234567"}'
  stock() { curl_net "$G/api/v1/products/$FOOD" | grep -o '"stockQuantity":[0-9]*' | cut -d: -f2; }

  echo "the shell and the two portals"
  expect_code "the shell answers" 200 http://shell:4200/
  expect_code "the catalog portal's remoteEntry.js answers" 200 http://catalog-portal:4201/remoteEntry.js
  expect_code "the sales portal's remoteEntry.js answers" 200 http://sales-portal:4202/remoteEntry.js
  expect_body "the shell's origin may load the sales portal" 'Access-Control-Allow-Origin: http://localhost:4200' -i -H 'Origin: http://localhost:4200' http://sales-portal:4202/remoteEntry.js
  expect_code "the browser's preflight of a purchase passes the gateway, with the Idempotency-Key header" 204 -X OPTIONS -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: idempotency-key,content-type' "$G/api/v1/orders"
  expect_body "...and the gateway allows that header" 'Access-Control-Allow-Headers: .*Idempotency-Key' -i -X OPTIONS -H 'Origin: http://localhost:4200' "$G/api/v1/orders"

  echo "a visitor buys, through the gateway, with no token"
  [ "$(stock)" = "24" ] && ok "the seed starts with 24 units" || bad "the seed must start with 24 units, found $(stock)"
  local first
  first="$(curl_net -i -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-visitor-0001' -d "$BODY" "$G/api/v1/orders")"
  if echo "$first" | head -1 | grep -q 201; then ok "the order is created (201)"; else bad "the order is not created: $(echo "$first" | head -1)"; fi
  echo "$first" | grep -q '"total":378000' && ok "...the total is the sum of the lines, computed by the service" || bad "...the total is not 2 x 189000"
  echo "$first" | grep -q 'totalFormatted":"\$[^0-9]*378.000' && ok "...and formatted the way the portal shows it" || bad "...the formatted total is missing"
  [ "$(stock)" = "22" ] && ok "the stock fell in MongoDB: 22" || bad "the stock must be 22, found $(stock)"
  local id; id="$(echo "$first" | grep -o '"orderId":"[^"]*"' | head -1 | cut -d'"' -f4)"

  echo "the same intention again, as the portal does after a lost connection"
  local again
  again="$(curl_net -i -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-visitor-0001' -d "$BODY" "$G/api/v1/orders")"
  if echo "$again" | head -1 | grep -q ' 200'; then ok "the same key answers 200, not 201"; else bad "the retry must be 200: $(echo "$again" | head -1)"; fi
  echo "$again" | grep -q "\"orderId\":\"$id\"" && ok "...with the SAME order" || bad "...but another order"
  [ "$(stock)" = "22" ] && ok "...and the stock was taken once" || bad "...but the stock moved to $(stock)"

  echo "what the portal translates"
  expect_body "a quantity above the stock is a 422 naming INV-PRODUCT-002" 'INV-PRODUCT-002' -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-visitor-0002' -d "${BODY/\"quantity\":2/\"quantity\":30}" "$G/api/v1/orders"
  [ "$(stock)" = "22" ] && ok "...and nothing was taken" || bad "...but the stock moved to $(stock)"
  expect_body "a missing contact is a 400 naming the field" '"field":"contactName"' -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-visitor-0003' -d "${BODY/Ana Torres/   }" "$G/api/v1/orders"
  expect_body "a delivery without an address names the field" '"field":"deliveryAddress"' -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-visitor-0004' -d "${BODY/PICKUP/DELIVERY}" "$G/api/v1/orders"
  expect_body "a key that is too short names the header" '"field":"Idempotency-Key"' -X POST "${JSON[@]}" -H 'Idempotency-Key: short' -d "$BODY" "$G/api/v1/orders"
  expect_code "a broken token is never taken for a guest (401)" 401 -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-visitor-0005' -H 'Authorization: Bearer not-a-token' -d "$BODY" "$G/api/v1/orders"

  echo "my orders"
  expect_code "a visitor cannot list orders: the gateway refuses (401)" 401 "$G/api/v1/orders"
  curl_net -o /dev/null -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-customer-0001' -H "Authorization: Bearer $CUSTOMER_T" -d "${BODY/\"quantity\":2/\"quantity\":1}" "$G/api/v1/orders"
  expect_body "a customer's order is in their list, as {data, meta}" '"meta":\{"page":1,"limit":20,"total":1,"totalPages":1\}' -H "Authorization: Bearer $CUSTOMER_T" "$G/api/v1/orders"
  if curl_net -H "Authorization: Bearer $CUSTOMER_T" "$G/api/v1/orders" | grep -q "$id"; then bad "...but the visitor's order is in it"; else ok "...and the visitor's order is not"; fi
  expect_code "a page of 101 is a 400" 400 -H "Authorization: Bearer $CUSTOMER_T" "$G/api/v1/orders?limit=101"
  [ "$(stock)" = "21" ] && ok "the stock is 21 after the second purchase" || bad "the stock must be 21, found $(stock)"

  echo "the shop is closed on Sunday (CA-C1.8): the clock is moved and the same purchase is refused"
  start_sales_api 2026-10-11T15:00:00Z
  expect_body "a purchase on a Sunday is a 422 naming INV-ORDER-008" 'INV-ORDER-008' -X POST "${JSON[@]}" -H 'Idempotency-Key: e2e-sunday-0001' -d "$BODY" "$G/api/v1/orders"
  [ "$(stock)" = "21" ] && ok "...and the stock did not move" || bad "...but the stock moved to $(stock)"
  start_sales_api "$OPEN_CLOCK"

  echo "the correlation id of a purchase, from the browser to both services (norm 5.3.9)"
  curl_net -o /dev/null -X POST "${JSON[@]}" -H 'X-Correlation-Id: e2e-trace-buy' -H 'Idempotency-Key: e2e-trace-0001' -d "${BODY/\"quantity\":2/\"quantity\":1}" "$G/api/v1/orders"
  docker logs "$GATEWAY" 2>&1 | grep -q 'e2e-trace-buy' && ok "it is in the log of the gateway" || bad "it is not in the log of the gateway"
  docker logs "$SALES" 2>&1 | grep -q 'e2e-trace-buy' && ok "...in the log of sales-api" || bad "...not in the log of sales-api"
  docker logs "$CATALOG" 2>&1 | grep -q 'e2e-trace-buy' && ok "...and in the log of catalog-api, which sales-api called" || bad "...and not in the log of catalog-api"

  [ "$fail" = 0 ] && echo "OK: the whole system does what it must" || { echo "FAILED"; exit 1; }
}

case "${1:-}" in
  up) up ;;
  check) check ;;
  clock) [ -n "${2:-}" ] || { echo "usage: bash scripts/e2e-real-stack.sh clock <ISO instant>" >&2; exit 2; }; start_sales_api "$2"; echo "the shop's clock is now $2" ;;
  down) down; echo "removed" ;;
  *) echo "usage: bash scripts/e2e-real-stack.sh up | check | clock <ISO> | down" >&2; exit 2 ;;
esac
