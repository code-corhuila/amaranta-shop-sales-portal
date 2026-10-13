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

The web interface of the sales domain: the cart, the checkout and my orders. It is a remote loaded by the shell, not an application of its own.

## Depends on

`amaranta-shop-front` (the shell: HTTP client and session) and, through the gateway, `amaranta-shop-sales-api`.

## How to run

Nothing to run yet. It is a remote of the shell: once it lands, `npm ci` and `npm start` serve it for the shell to load.

## Stack

The interface framework is pending its own ADR (norm 4.2.2).

## Status

**Skeleton.** Only the base of a code repository is here (norm 5.1); nothing in it runs yet, and this README says so
on purpose. Next pull request: `feat/cart-and-checkout`: the cart and checkout screens.
