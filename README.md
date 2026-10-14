# amaranta-shop-sales-portal

> sales bounded context: web UI (remote)

Part of the **Amaranta Shop** distributed system — team `amaranta-shop`, Grupo 2.
Governance and documentation live in [`amaranta-shop-docs`](https://github.com/code-corhuila/amaranta-shop-docs).

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `amaranta-shop-docs`.

## Role in the system

The web interface of the **sales domain**: the cart, the checkout and my orders. It is a **remote** loaded by the shell
(`amaranta-shop-front`) when the route `/sales` is opened, not an application of its own.

| Screen | Route (under `/sales`) | Who | Talks to |
|---|---|---|---|
| Cart | `/cart` | anyone | nothing: the cart lives in the shell |
| Checkout | `/checkout` | anyone (a guest may buy) | `POST /api/v1/orders` |
| Confirmation | `/confirmation` | whoever just ordered | nothing: it shows the order the service returned |
| My orders | `/`, `?page=` | signed-in users | `GET /api/v1/orders?page=&limit=20` |

## The rule this portal obeys (Annex H)

**The HTTP client, the session and the cart live in the shell, and only there.** The portal borrows three things from the shell
through Module Federation: `shell/apiClient` (relative paths such as `/api/v1/orders`), `shell/auth` (`useSessionInfo()`: whether
someone is signed in, **never the token**; and `RequireAuth` to guard My orders) and `shell/cart` (the lines the catalog portal
added). It never calls `fetch`, never touches a token, and does not know where the gateway is. The `build` stage of
`deploy/Dockerfile` greps the **compiled** code for the gateway address and the token.

## What each screen does (Annex H)

| Rule | Where |
|---|---|
| Four states, designed: loading, an error with the reference and a retry, empty, and data | My orders |
| A newer request replaces the older one: the older is cancelled and its answer ignored even if it arrives late | `hooks/useRequest.ts` |
| An error shows the text the shell decided for the person and the `traceId` to give | `model/failure.ts`, `FailureNotice` |
| **One `Idempotency-Key` per intention.** Confirming the same order again (after a lost connection) reuses the key, so the service answers `200` with the order it already made and nothing is duplicated; a changed order is another intention with another key; the key is renewed after a success | `hooks/useIdempotencyKey.ts`, `CheckoutPage` |
| The button is disabled while the request is pending, so a double click cannot place two orders | `CheckoutPage` |
| Money is whole pesos, summed as `BigInt`; a float never gets in. The total of an order is the **service's**; the cart only shows an estimate | `model/money.ts` |
| A label for every field; what is wrong is written beside the field and joined to it (`aria-describedby`); the cursor goes to the first one that is wrong | `CheckoutPage` |
| What the service refuses is shown in the person's words, beside the field it named: a missing contact, a delivery without an address, a quantity above the stock, and the shop being closed (Monday to Saturday 08:00-12:00 and 14:00-18:00, Bogotá time; Sunday closed) | `model/checkoutForm.ts` |
| Dates are shown in Bogotá time, whatever the browser's | `model/dates.ts` |

Money is written the way the services write it: `$`, a non-breaking space and a dot for every thousand (`$ 378.000`).

### The look

The stylesheet (`src/sales/sales.css`) has no colour of its own: every colour, radius and shadow is a token of the shell's design
system (ADR-007). A test reads it and fails on a literal colour, on a token the shell does not define, and on removing the focus
ring.

## Stack

React 19, Vite, strict TypeScript, Vitest and Module Federation (`@module-federation/vite`), on Node 22: the same toolchain as the
shell. The choice of React is recorded in ADR-014 of `amaranta-shop-docs`.

## How to run

You need only Docker; nothing is installed on the machine.

```bash
bash scripts/test.sh
```

In containers, from the versioned `package-lock.json` (`npm ci`), it runs:

1. the strict type check and the test suite (**107 tests**, written first);
2. the production build, which must produce `remoteEntry.js` and whose compiled code must not contain the gateway address or a token;
3. the final image, started, and `tests/serve.sh` against it: `remoteEntry.js` is never cached, hashed files are cached for a
   year, a missing file is a `404`, and only the shell's origin may load it.

### The whole system, for real

```bash
bash scripts/e2e-real-stack.sh up
```

It builds and starts PostgreSQL and MongoDB (in memory), the structure and data of `sales-db` and `catalog-db`, `sales-api`,
`catalog-api`, the gateway, the shell and both portals, with nothing replaced by a double. The other repositories must sit next
to this one, or be named in `SALES_DB_DIR`, `SALES_API_DIR`, `CATALOG_DB_DIR`, `CATALOG_API_DIR`, `GATEWAY_DIR`, `FRONT_DIR` and
`CATALOG_PORTAL_DIR`. The shell is then at `http://localhost:4200`. Then:

```bash
bash scripts/e2e-real-stack.sh check
```

asserts, over HTTP, what the chain must do: a visitor buys with no token and the stock falls; the same key again answers `200`
with the same order and the stock does not move again; what the portal translates (`422` for a quantity above the stock, `400`
for a missing contact, a delivery without an address, a key that is too short, a broken token never taken for a guest); a
customer's order is in their list and a visitor's is not; on a Sunday (the clock of `sales-api` is moved with
`bash scripts/e2e-real-stack.sh clock <ISO instant>`) the same purchase is refused; and **one `X-Correlation-Id` appears in the
log of the gateway, of `sales-api` and of `catalog-api`**, which `sales-api` called. `check` expects the fresh seed (24 units of
the product it buys): run `down` and `up` again to repeat it. To remove everything it created, the keys and tokens included:

```bash
bash scripts/e2e-real-stack.sh down
```

## Verified

Besides the tests, in a real browser with that whole chain up: a guest adds a product in the catalog, sees the cart with its badge
in the header, fills the checkout, and confirms; the browser's preflight passes the gateway with the `Idempotency-Key` header, the
service answers `201`, the confirmation shows the number of the order the service made, the cart is emptied, the stock in the
catalog has fallen by the quantity bought, and the database holds exactly one order.

## Status

Done: the cart, the checkout, the confirmation and My orders. Not done:

- **My orders, the replay message and the closed-shop message in a browser.** They are tested (unit tests, and the checks over HTTP
  against the real services) but were not clicked through in a browser; the purchase was.
- **A way to read one order back.** The services have no such route, so the confirmation lives only as long as the page.
- **The staff screens** (an in-store sale, marking an order as paid) are not part of this portal yet.
- The portal has **no sign-in of its own**, by design: the shell's development sign-in exists only while developing, and the
  identity portal does not exist yet.
