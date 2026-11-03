# Ecommerce tracking and confirmed WhatsApp sales import

## Implemented contract

- One GTM container: `GTM-M2GVDQ44`. No hard-coded gtag loader or parallel GA4/Ads tags.
- Every ecommerce push clears `ecommerce` first. USD numbers, real transaction IDs, stable compound-strength item IDs, list price and separate unit discount.
- `view_item` on product/strength changes; `add_to_cart` only for added units; `view_cart` on cart open; `begin_checkout` when the checkout fields become available; `add_payment_info` when a method is chosen.
- Card `purchase` is gated by persisted payment status through a signed receipt endpoint, including 3DS and card-payment links. A query string never proves payment.
- A card order a promo code covers in full ($0 in both currencies, code saved on the order) never reaches the gateway: `/api/chargx/process-card` saves it as Paid, takes the stock and sends the usual confirmations, and the thank-you page then emits a card `purchase` with value 0. The decision comes from the saved order row, never the request, and a $0 order with no promo code is still refused.
- WhatsApp checkout saves the order and opens thank-you without requiring the customer to send a WhatsApp message. On the thank-you page it emits `whatsapp_order`. A WhatsApp order with a real total never emits `purchase` there: that waits for confirmed payment (the server sends below). A $0 WhatsApp order has nothing to pay, so it also emits a `purchase` with `payment_type: whatsapp` and the same transaction ID straight away. Card emits `purchase` only once payment is confirmed.
- Both receipt events are deduplicated in sessionStorage per event/transaction. Contact fields are available only on the signed receipt response for Enhanced Conversions (owner explicitly approved their use).
- Contact, affiliate-source contact and business application successes send `generate_lead` with `form_name`.
- Centralized WhatsApp-link capture uses the agreed `click_location` allow-list. Programmatic existing buttons carry explicit attributes. Referral sharing and checkout submission are not enquiry clicks.
- The existing USD display uses the product USD price and the current authoritative exchange rate for CRC display. Tracking uses those same prices/rate, not a second hard-coded FX rate. Paid snapshot value is saved by the server after repricing and excludes delivery; delivery has its own shipping field.

### GTM team mapping

The requested dataLayer contract uses **list unit price** plus `discount`. GA4's item price convention is the discounted price: map GA4 item `price` to `price - discount` while preserving the separate `discount` field if item-revenue reporting is required. `ecommerce.value` is already the authoritative net product value and must not be discounted again.

Do not forward `user_data.email` or `user_data.phone` as normal GA4 event parameters. Use them only in the Google Ads Enhanced Conversions user-provided-data mapping; GTM handles hashing and the site's configured consent behavior. No customer consent is fabricated by the importer. Data Manager applies row/account consent settings and may return consent errors requiring account configuration.

`payment_type` is top-level on the two receipt events and inside ecommerce for `add_payment_info`. Configure the requested GA4 custom dimensions for payment_type and click_location. Keep whatsapp_order secondary/non-purchase for orders with a real total; only paid WhatsApp imports should optimize for the WhatsApp sale action. The one browser WhatsApp `purchase` is for $0 orders.

## Database installation

Run `add-google-ads-conversions.sql` in the production Supabase SQL Editor before activating uploads. It adds:

- `orders.ad_attribution`, `orders.analytics_snapshot`, immutable first `orders.ads_paid_at`.
- An RLS-protected conversion export queue and service-role-only lease function.
- Triggers that queue only new confirmed WhatsApp payment transitions, including CRM/manual orders. Old paid rows with unknown payment time are deliberately not backfilled as paid today.

New ad clicks are kept in a 90-day cookie (gclid/gbraid/wbraid and arrival time), then stored on the order. Returning visits without an ad ID preserve the original expiry. An analytics-column mismatch never prevents a sale; checkout logs the missing migration, but attribution cannot be durable until SQL is installed.

## Google setup

Repository and production environment-variable-name checks found no pre-existing Google Ads/OAuth configuration. Set these **server-side production Vercel environment variables**, never in chat or NEXT_PUBLIC variables:

- `GOOGLE_ADS_CUSTOMER_ID`: conversion-owning Ads customer ID.
- `GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID`: numeric ID of the confirmed WhatsApp purchase action.
- `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`.
- Optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for manager access.
- `CRON_SECRET` already exists. Optional `ANALYTICS_RECEIPT_SECRET` can separate analytics signing from existing payment signing.

Enable Data Manager API on the Google Cloud project; authorize the OAuth token with `https://www.googleapis.com/auth/datamanager` and access to the destination Ads account. Configure the conversion action and required enhanced-conversion/consent settings with the marketing owner. A developer token is not used for this Data Manager integration.

Google's current guidance routes new offline-conversion integrations to Data Manager rather than the restricted legacy UploadClickConversions path:
https://developers.google.com/google-ads/api/docs/conversions/upload-offline
https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest
https://developers.google.com/data-manager/api/reference/rest/v1/requestStatus/retrieve

## Validate and enable

1. Signed-in superadmin: GET `/api/admin/google-ads/status` reports missing environment variable **names**, schema readiness and queue counts; no customer data or credentials are returned.
2. Signed-in superadmin: POST `/api/admin/google-ads/validate` with `{ "orderId": "<confirmed WhatsApp order UUID>" }` sends a **validateOnly** request. It does not create an Ads conversion or advance the queue. Contact identifiers are SHA-256 hashes; neither raw contact values nor OAuth credentials are logged.
3. Once validation passes, set `GOOGLE_ADS_OFFLINE_ENABLED=true` and redeploy.
4. The Vercel cron runs daily at 08:00 UTC (13:00 Pakistan; 02:00 Costa Rica). The route requires the CRON_SECRET bearer token; a spoofable cron header does not authorize uploads.
5. Check the next job and queue acceptance counts. HTTP acceptance is recorded as submitted; a later run retrieves Google processing results before marking accepted.

The durable queue catches all eligible new confirmations, rather than a fragile last-24-hours-only window. It retries outages, leases concurrent jobs safely, uses the real order number for Google's deduplication, and can process up to 500 queued orders within its bounded runtime. Any remaining queue stays due for the next run. Invalid/unpaid/card/test/excluded orders are skipped; failed requests remain observable and retry up to 20 attempts. Inspect Google diagnostics using the stored request ID. Changes to the configured destination do not silently redirect previously submitted requests.

The offline Ads value is the confirmed total paid in USD, less any refund already recorded before upload. Browser ecommerce value excludes shipping as specified. Refunds after an accepted upload are not automatically retracted by this change; a separate conversion-adjustment workflow is needed for historical refunds.

This importer targets Google Ads only. Paid WhatsApp sales reach GA4 through the separate sender below; the browser sends `whatsapp_order` at checkout, plus a `purchase` for $0 WhatsApp orders only (the paid senders never send $0 orders, so nothing is counted twice).

## GA4 purchase for paid WhatsApp orders

When a WhatsApp order is confirmed paid, `/api/cron/ga4-whatsapp-purchases` (every 15 minutes) sends GA4 a server-side `purchase` (Measurement Protocol) with `payment_type: "whatsapp"`, the real order number as `transaction_id`, the same net product value and items the card `purchase` uses, and the shopper's GA4 client and session IDs saved at checkout (`orders.ga_client_id` / `ga_session_id`). A CRM/manual order has no browser IDs and is sent as a new visitor, so it still counts as revenue but has no traffic source.

Setup:

1. Run `add-ga4-whatsapp-purchases.sql` in the Supabase SQL Editor (needs `add-google-ads-conversions.sql`).
2. Set server-side production Vercel variables: `GA4_MEASUREMENT_ID` (the web stream's `G-…` ID) and `GA4_API_SECRET` (GA4 Admin > Data streams > Measurement Protocol API secrets). Never NEXT_PUBLIC, never committed.
3. Signed-in superadmin: POST `/api/admin/ga4/validate` with `{ "orderId": "<confirmed WhatsApp order UUID>" }`. It uses Google's validation endpoint: nothing is recorded and `validationMessages` must be empty.
4. Set `GA4_OFFLINE_ENABLED=true` and redeploy. The cron skips quietly until then.

GA4 rejects events older than 72 hours, so only orders confirmed paid within the last 70 hours are sent; each order is sent once (`ga4_purchase_exports`), failures retry up to 5 times, and GA4 also de-duplicates `purchase` by `transaction_id`. Test, excluded, unpaid and $0 orders are skipped. Measurement Protocol answers 204 even for events it ignores, so check GA4 DebugView/Realtime after the first real order.

## Verification status

Automated tests use synthetic orders only: USD and CRC, item/strength identity, unit discounts, shipping separation, receipt authentication, payment status gating, session deduplication, contact normalization/hashing, 90-day attribution, unpaid/card/test exclusions, OAuth requests, validateOnly, retries and asynchronous acceptance/partial-failure handling.

Before campaign launch, the marketing owner still needs to run the supplied GTM Preview + GA4 DebugView checklist in English and Spanish, on USD and CRC displays, after SQL/configuration. No real card charge, real customer order, production contact-data upload, GTM edit or Ads account change was performed by the code tests. The broader checkout regression run has one known pre-existing source-regex failure about exchange-rate code; the focused analytics suite passes.
