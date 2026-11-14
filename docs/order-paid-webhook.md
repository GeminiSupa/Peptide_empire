# Order webhook (paid / cancelled / refunded) — Costa Rica

What the catalog POSTs to an external tracker when a Costa Rica order settles,
and when a settled order is later taken back. This is the document to hand the
media buyer.

Agreed with the media buyer on 14 Nov 2026. Code: `src/lib/orderPaidWebhook.mjs`.

## Where it goes

One URL, set per environment, nothing hard-coded:

| Variable | What it does |
| --- | --- |
| `ORDER_WEBHOOK_URL` | Where to POST. **Unset = nothing is sent at all.** |
| `ORDER_WEBHOOK_SECRET` | Shared secret. Sent as a header and used for the signature. Unset = neither header is sent. |
| `ORDER_WEBHOOK_SIGNATURE_HEADER` | Name of the signature header. Default `X-Webhook-Signature`. |
| `ORDER_WEBHOOK_TIMEOUT_MS` | Per-attempt timeout. Default 5000. |
| `ORDER_WEBHOOK_ALL_ORDERS` | `true` sends every paid order. Unset = only orders that came through a paid ad. |

Headers on every call:

```
Content-Type: application/json
X-Webhook-Secret: <ORDER_WEBHOOK_SECRET>
X-Webhook-Signature: <HMAC-SHA256, hex, of the exact request body, keyed with the same secret>
```

The signature covers the raw bytes we send, so verify it before parsing.

## When it fires

| Event | Fires |
| --- | --- |
| `order.paid` | Once, on the real unpaid → paid move. Covers card, crypto, bank/SINPE and a staff "mark as paid". Re-saving an order that is already paid sends nothing. |
| `order.cancelled` | When a **previously paid** order is set to cancelled, declined, payment blocked or error. |
| `order.refunded` | When a **previously paid** order is refunded, in full or in part. |

Cancelling or refusing an order that never paid sends nothing — nothing was
ever reported, so there is nothing to take back.

**Only paid-ad orders are sent** (owner, 15 Nov 2026): an order must carry at
least one of `ref`, `cid` or `ttclid`. An organic, direct or WhatsApp sale has
none of them, so there is nothing for the receiver to match and it is not sent
at all. The cancel and refund events follow the same rule, so the receiver is
never told to take back a sale it was never told about.

## Body

```json
{
  "event": "order.paid",
  "status": "Paid",
  "orderId": "c4c93d4a-35e9-46f0-bb64-9c5abb8fc3ec",
  "orderNumber": "W-MWGCZ7NW-J5Z2",
  "ref": "tiktok-glp1-a",
  "cid": "abc123",
  "ttclid": "E.C.P2_ABC",
  "product": "glp-1-rt-agonista-triple-15mg",
  "productName": "GLP-1 (RT) – Agonista Triple 15mg",
  "products": [
    { "product": "glp-1-rt-agonista-triple-15mg", "name": "GLP-1 (RT) – Agonista Triple 15mg", "qty": 1, "price": 46000 }
  ],
  "amount": 46000,
  "currency": "CRC",
  "amountUsd": 90.57,
  "amountCrc": 46000,
  "occurredAt": "2026-11-14T01:07:00.000Z",
  "paidAt": "2026-11-14T01:07:00.000Z"
}
```

- `amount` is a plain number **in `currency`** — colones for a CRC order, which
  is nearly every Costa Rica sale. `amountUsd` / `amountCrc` are both given so
  the other side never has to convert.
- `ref` is the `?ref=` of the landing page, `cid` the `?cid=` click id and
  `ttclid` TikTok's `?ttclid=`, all read off the landing URL and kept with the
  order. Null on an organic sale.
- `product` is the biggest line of the order by value, with gift lines (the free
  BAC water) excluded; `products` lists every paid line. **Our products have no
  SKU or slug of their own**, so the slug is derived from the Spanish product
  name: accents stripped, lowercased, hyphenated. It is stable unless a product
  is renamed, and `name` travels alongside it for mapping.
- `paidAt` appears on `order.paid` only. Every event carries `occurredAt`.
- A refund event also carries `refundedAmount` (plus `refundedAmountUsd` /
  `refundedAmountCrc`) when an amount has been recorded; `amount` stays the
  original order total.

## Delivery, retries and duplicates

- **Never more than once per order per event.** The paid event is guarded on the
  status transition, so two settle paths cannot both fire it.
- **Retries:** 3 attempts in total, ~0.4s then ~1.2s apart, for a network error,
  a timeout, a 5xx or a 429.
- **No retry on any other 4xx.** A refused body will be refused again; the
  status and the receiver's own response text are logged instead
  (`ORDER REFUSED 422 …` in the catalog's Vercel logs).
- **Best-effort by contract.** A failure is never thrown: a down receiver must
  not break a customer's payment confirmation. Nothing is queued, so a webhook
  that fails all three attempts is lost — if that matters, the receiver must
  accept and park the call rather than reject it.

## What is NOT covered

- **WhatsApp sales.** Most Costa Rica ad traffic goes from the ad into
  WhatsApp, and an agent types the order in by hand. No landing URL is ever
  loaded, so `ref` / `cid` / `ttclid` are null and the receiver (which answers
  422 without a click id) will refuse them. Attributing those needs a code in
  the first WhatsApp message, which is a separate change.
- **The main website** (`peptidescostarica.net`, branch `main`) posts its orders
  to this app's `/api/orders/create` and today sends `landing_ref` only. It must
  be taught to forward `cid` and `ttclid` the same way, or sales that start on
  an ad landing page and finish on the website arrive without a click id.
