# Vendored catalog pricing modules

These four files are **verbatim copies** from the catalog application
(`main` branch, `src/lib/`):

| file                      | copied from                      |
| ------------------------- | -------------------------------- |
| `pricing.mjs`             | `src/lib/pricing.js`             |
| `bacWater.mjs`            | `src/lib/bacWater.mjs`           |
| `bulkDeal.mjs`            | `src/lib/bulkDeal.mjs`           |
| `fallbackExchangeRate.mjs`| `src/lib/fallbackExchangeRate.mjs`|

## Why copies and not a reimplementation

The storefront on this branch has to show a shopper the same total that
`catalog.peptidescostarica.net/api/orders/create` will charge them. That
endpoint prices every order from the database and **refuses an order whose
posted total disagrees with the total it computes**. A second, hand-written
pricing implementation here would drift from it, and the first symptom would
be a customer shown one number and charged another.

So this storefront does not do its own arithmetic. It runs the catalog's own
functions over the catalog's own product rows.

## What is authoritative

**Checkout is.** Nothing in this directory decides what anyone pays. These
functions exist so the price on the button matches the price on the invoice;
when they disagree anyway (the exchange rate moved between page load and
submit, a product was repriced), checkout answers `409 price_changed` with its
own figures and `lib/storefront/order.js` re-posts at the server's number.
See the reprice path there.

## Keeping them in step

They are pure functions with no server dependencies, which is what makes
copying safe. Do not edit them here. If the catalog changes its pricing rules,
re-copy all four and re-run `npm test` — `tests/pricing-parity.test.mjs`
asserts these files are byte-identical to the catalog's when that checkout is
present on disk, so a drift shows up as a failing test rather than as a
mispriced cart.

`pricing.mjs` also carries the catalog's FX-provider code, which this site
never calls — it reads the rate from the catalog's `/api/exchange-rate`
instead (see `lib/storefront/exchange-rate.js`). It is kept so the file stays
byte-identical to its source.
