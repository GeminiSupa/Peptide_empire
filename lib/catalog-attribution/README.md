# Vendored catalog attribution code

Verbatim copies of three files from the catalog (`main` branch, `src/lib/`):

| here | catalog |
| --- | --- |
| `adClickAttribution.mjs` | `src/lib/adClickAttribution.mjs` |
| `gaIdentity.mjs` | `src/lib/gaIdentity.mjs` |
| `orderAttribution.mjs` | `src/lib/orderAttribution.mjs` |

The catalog's `/api/orders/create` reads the Google Ads click
(`ad_attribution`) and the GA4 client/session IDs off every order, and
re-checks them with these same functions. Using the catalog's own code to
capture and read them means the site sends exactly what checkout accepts.

**Do not edit these files.** Re-copy them when the catalog changes them;
`tests/attribution-parity.test.mjs` fails until they match. Site-specific
logic lives in `lib/site/attribution.mjs`.
