# Peptides Costa Rica — start here

**This file is the single source of project context** for every person and
every agent (Claude Code, Codex, anything else). `AGENTS.md` and `CLAUDE.md`
on every branch only point here. Never put context or rules in them, and
never create another context file. Update this file (on branch `catalog`) when
something changes.

This one repo holds **two apps, one per branch, each its own Vercel
project**. Each has its own README with that app's detailed rules:

| Branch | App | Vercel project | Live at | Its README |
| --- | --- | --- | --- | --- |
| `catalog` | The catalog: shop, cart, checkout, orders, payments, admin portal, CRM, WhatsApp bot, deals, pricing, 18 cron jobs, every DB migration | `peptidecosta` | `catalog.peptidescostarica.net` | [`README-catalog.md`](README-catalog.md) |
| `main` | The main business site (new design, its own cart; replaced WordPress on 9 Nov 2026) | `peptidecostarica-website` | `peptidescostarica.net` (+ `www.`) | [`README.md` on `main`](../../blob/main/README.md) |

Branches were renamed on 9 Nov 2026: `website` → `main`, and the old
`main` → `catalog` (Vercel production branches changed to match). Older
notes, commits and other people's copies may still use the old names.

Read this file, then the README of the app you are changing.

- Agents on the `main` branch (the website): this file is not on your
  branch. Read it with
  `git fetch origin catalog && git show origin/catalog:README.md`.
- **Pushing `main` or `catalog` deploys to production at once.** Push only
  when the developer you work for says to.
- **Never merge `main` and `catalog` into each other.** Different apps with
  deliberately separate file layouts and histories.
- **Feature branches** (`codex/…`, `catalog-…`, `affiliate-dashboard` and the
  rest) hold real, unfinished catalog work. Don't delete, rebase or merge one
  unless the developer you work for says so. Catalog branches merge into
  `catalog` only. A branch made before 9 Nov 2026 has older context files; merge
  `catalog` into it to bring this structure in.
- **Retired, never use:** the separate repo
  `GeminiSupa/peptidecostarica-website` (stopped 18 Oct 2026; its local
  copies `C:\Users\Maaz\Projects\peptidecostarica-website` and
  `H:\Joe Webster\peptidecostarica-website` still have a `.vercel` link that
  would overwrite the main site), and the address `new.peptidescostarica.net`.

## The people

Two developers work on this repo as equals, in different places. Both direct
Claude Code and Codex, do QA, decide what ships and push. Treat both exactly
the same — "the owner", "Omer" or "he" in any README means whichever of them
you are working for. Joe Webster holds money authority — never ask either
developer to approve payouts.

## Local setup

On a fresh machine, check out the branch you need:

```bash
git clone https://github.com/GeminiSupa/peptidecosta.git
cd peptidecosta
git switch main      # the website; `git switch catalog` for the catalog
npm install
npm run dev
```

One developer keeps both side by side in `C:\Projects\costa-website-catalog\`:
`peptidecosta/` (branch `catalog`) and `peptidecosta-website/` (branch
`main`, a git worktree). Paths like that in these files are that
developer's local folders. In that folder, the local `peptidecosta/` holds
uncommitted edits from other people and is behind `origin/catalog`: do not
commit, reset or stash there; change the catalog from a separate worktree off
`origin/catalog`.

Env vars live in each Vercel project (Settings → Environment Variables).

## Where things stand (9 Nov 2026)

- **`peptidescostarica.net` is the new site.** The owner moved the domain from
  WordPress to Vercel on 9 Nov 2026. `peptidescostarica.net` (and
  `www.peptidescostarica.net`, to be redirected to it) serve the
  Vercel project (`peptidecostarica-website`, branch `main`). Every page
  declares `https://peptidescostarica.net/...` as its canonical. WordPress no
  longer serves the public domain.
- **`new.peptidescostarica.net` is retired** (owner, 9 Nov 2026). It was the
  pre-launch test address. Never link, configure or rely on it; it is being
  removed from Vercel and DNS.
- **`catalog.peptidescostarica.net` is still live and still needed.** Customers,
  ads, emails and WhatsApp links still send traffic there, and moving them
  takes time. Both sites run side by side for the foreseeable future; do not
  plan to switch the catalog off.
- **Checkout today:** the new site's cart posts every order to the catalog's
  `/api/orders/create`, and card/bank payment and their confirmation pages run
  on the catalog. A full copy of that code now exists in the website (branch `main`),
  switched off (see "Own checkout" below).
- **Indexing is on** (9 Nov 2026): `NEXT_PUBLIC_ALLOW_INDEXING=true` is set in
  the website's Vercel project (Production); `peptidescostarica.net` sends
  `index, follow`, `robots.txt` allows all and points at `/sitemap.xml`.

## THE GOAL — read this before anything else (owner, 8 Nov 2026)

The new site (`peptidecosta-website`, served at `peptidescostarica.net`) **is
the main business site**. It is not a marketing clone or a preview, and "not
live yet" is never a reason to skip back-end work.

1. **It must be able to run the whole Costa Rica business on its own.** If
   `catalog.peptidescostarica.net` were ever shut down, customers and staff must
   notice nothing: checkout, every payment method, the card and bank payment
   pages, customer and business accounts, admin and CRM, the WhatsApp bot and
   cart recovery, scheduled jobs, links in emails and WhatsApp messages, GA4 /
   Tag Manager and Google Ads conversions. Today most of that still runs on the
   catalog app; anything that only works because the catalog subdomain exists
   is a gap to close, not an acceptable dependency. (The catalog is not being
   shut down — this is the safety net.)
2. **While both are running, nothing may duplicate or conflict:** one order
   per checkout, no double purchase/conversion events, no double CRM leads,
   carts or WhatsApp messages, no scheduled job running twice, only one site's
   pages competing in Google for the same content, no price shown on one that
   is charged differently on the other.

Judge every change against those two rules.


## Hard rules

- **Work in one app at a time.** Fixing a website page never means editing
  the catalog, and vice versa. If a change seems to need both, stop and say so.
- **Read the app's own README** (table above) before changing code — pricing
  parity, QA rules, migrations, offer types, the checkout copy.
- **Prices are decided only by the catalog's pricing code.** The website shows
  prices with a verbatim copy (`lib/catalog-pricing/`) and never does its own
  arithmetic.
- **Secrets.** Never commit an `.env` file, never print or paste key values
  (in chat, logs, commits or docs). Refer to variables by name only.

## How the two sites relate at runtime

- Both read and write the **same Supabase database**.
- The website reads products, prices, stock, banners, hidden products, reviews
  and business links from Supabase with the public anon key, and shows prices
  with the catalog's pricing functions.
- Orders: the website's cart posts to the catalog's `/api/orders/create`,
  which re-prices every order and is the only thing that decides what is
  charged. It accepts browser orders only from a `peptidescostarica.net` host
  (apex or any subdomain), so the main domain can take orders.
- Card / ACH / crypto payment continues on the catalog's `/pay-card`;
  SINPE and bank transfer on the catalog's `/pay-bank`; the gateway's webhook
  calls the catalog.
- **Two card gateways since 12 Nov 2026.** Givver and ChargX are the same
  platform with different stores and rates, so the catalog picks one per
  payment type: `CARD_GATEWAY=givver` takes card and crypto (11% instead of
  12%), `ACH_GATEWAY=chargx` keeps bank transfer where it works, because
  Givver has not turned ACH on yet. Dropping `ACH_GATEWAY` moves everything
  to Givver; setting neither keeps everything on ChargX. Both webhooks land in
  one handler (`/api/chargx/webhook`, also served at `/api/givver/webhook`),
  and each order's Descriptor says which store took it — that is where a
  refund has to be made.
- Still fetched from the catalog by the website: the deal of the week, the
  exchange rate, visitor analytics, lead forms, and the relayed CRM endpoints
  (promo validation, abandoned-cart save/clear, newsletter, referral scans,
  WhatsApp opt-in) — see `catalogUrl()` callers in the website.
- Only on the catalog: admin portal, CRM, WhatsApp bot, customer/business
  accounts, affiliate dashboards, cron jobs, migrations.
- GTM `GTM-M2GVDQ44` (GA4 `G-3B3PP5CKLE`, Google Ads `AW-18193858920`) loads
  on both sites, only on `peptidescostarica.net` hosts.

### Own checkout (website, branch `main`, 8 Nov 2026 — pushed 9 Nov, switched off)

The owner chose a **full copy** of the catalog's checkout and payments into the
website, so the business survives without the catalog. Details in
the website's `README.md`. In short: `scripts/sync-catalog-checkout.mjs`
copies the catalog's files verbatim (with a short list of patches) and
`--check` fails if they drift; it is switched on by
`NEXT_PUBLIC_OWN_CHECKOUT=true` once the website's Vercel project has the
catalog's server keys. Card/bank confirmation lives at `/order-confirmation/`
on the website (its `/thank-you/` is the WhatsApp one).

## Environment variables

- **Website Vercel project (`peptidecostarica-website`):** runs on built-in defaults (Supabase URL + anon key, catalog
  origin, site URL), plus `NEXT_PUBLIC_ALLOW_INDEXING=true` (set 9 Nov,
  Production only). To switch on its own checkout it also needs the
  catalog's server keys plus `NEXT_PUBLIC_OWN_CHECKOUT=true` — but **never**
  the catalog's `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL`.
- **Catalog Vercel project (`peptidecosta`):** 105 production variables. Most
  are marked **Sensitive**: Vercel never shows or downloads their values, so
  they cannot be copied project-to-project from the dashboard.
- **Givver (12 Nov 2026), catalog project:** `CARD_GATEWAY=givver`,
  `ACH_GATEWAY=chargx`, `GIVVER_PUBLISHABLE_API_KEY`,
  `GIVVER_WEBHOOK_SECRET` (shown once when the webhook is created in Givver →
  Settings → Webhooks), optionally `GIVVER_TEST_PUBLISHABLE_API_KEY` and
  `GIVVER_API_BASE_URL`. The ChargX names stay as they are: bank transfer
  still uses them, and so does the admin sandbox test tool.
- **Local files (gitignored):**
  - `peptidecosta/.env.local` — the owner's working copy (63 names).
  - `peptidecosta/.env.production.local` — merged 9 Nov from Vercel + the
    owner's and the other developer's env files: 107 names, **30 blank**
    because they exist only as Sensitive values in Vercel (incl.
    `INTERNAL_API_SECRET`, `ORDER_RECEIPT_BCC`, `CHARGX_WEBHOOK_SECRET`, the
    `TAX_RECORDS_SMTP_*` and `CAMPAIGN_SMTP_*` sets, `CRON_SECRET`,
    `GA4_API_SECRET`, `OPENAI_API_KEY`). Only whoever entered them can supply
    them.
  - `peptidecosta-website/.env.local` — Supabase URL and anon key only.
- The website does not need a service-role key until its own checkout is
  switched on.

## Deploying

Two Vercel projects, both fed from this one repo. The catalog project builds
`catalog`; the website project builds `main`. A `NEXT_PUBLIC_*` variable only
takes effect after a redeploy. Vercel bills per team member and per usage —
adding a project costs nothing.

## Open items (keep this list current)

Owner (Omer) to do or decide:
1. ~~Turn indexing on~~ — done 9 Nov 2026.
2. Owner does not want `new.peptidescostarica.net` (9 Nov): remove it in
   Vercel → `peptidecostarica-website` → Domains, and delete its `new` CNAME
   at Namecheap (DNS for the domain is Namecheap, `registrar-servers.com`).
   Nothing in code depends on it. Make `www.` redirect (308) to the apex.
3. Submit `sitemap.xml` in Google Search Console. The existing property is
   verified by the two `google-site-verification` meta tags kept from
   WordPress (in `app/(en)/layout.js`); which Google account owns it is
   unknown — check the owner's accounts, else ask the former WordPress
   developer to add him as Owner, or verify a Domain property by DNS TXT.
4. ~~Push the switched-off checkout copy~~ (pushed 9 Nov). Get the 30 Sensitive
   values from the other developer; then add keys + `NEXT_PUBLIC_OWN_CHECKOUT`
   and place one test order.
5. OK to push the catalog fix that refuses orders for hidden products
   (branch `fix/hidden-products-checkout`, worktree `catalog-hidden-fix`).
6. Decide: customer/business accounts on the website; the 29 unsaved Codex
   Spanish translation files in the retired repo; Joey's page editor (Codex
   branch `codex/website-admin` vs fresh); card page opening ChargX in a new
   tab; cancel the 7 "Omer Test" orders (`W-MW7…` numbers).
7. Google Ads click IDs on CRM orders (branch `catalog-lead-click-id`,
   9 Nov 2026): 0 of 117 uploaded orders had a gclid because the `/lp` and
   `/glp-1` lead forms never kept it and staff create those orders by hand.
   Now the lead keeps the click (`catalog_leads.ad_attribution`) and the
   Google Ads upload copies it onto the matching order (same email, or same
   last 8 phone digits). To ship: run `add-lead-ad-attribution.sql` in the
   Supabase SQL Editor, then merge the branch into `catalog` and push. Only new
   leads get a click; orders already uploaded cannot be changed. Not covered:
   the catalog's entry gate (`/api/leads/capture`) and the website's own
   forms, which post to the catalog from another domain without the cookie.
8. Later: send `catalog.peptidescostarica.net` traffic to the main site
   (Belhassen's request) — only once the website does everything the catalog
   does.
9. "Related products" per product (10 Nov 2026, Belhassen/Bumsoo, for Google
   Ads compliance on the GLPTZ test page): admin → Products → "Related
   Products" column (Automatic / None / Choose products), saved in
   `site_settings` row `related_products`; the website's product page follows
   it for "More in …" and "Frequently ordered together" (free BAC Water
   stays). Branches `feat/related-products-setting` (catalog) and
   `feat/related-products-website` (main); push in either order, nothing
   changes until a product is set. No migration. Not covered: the catalog's
   own cart "You might also like" and the website cart's suggestions.
10. Givver on the catalog — **live since 12 Nov 2026** (`f4798089`, merged into
    `catalog` and deployed). Card and crypto are taken by Givver at 11%; bank
    transfer stayed on ChargX because Givver has not turned ACH on. All four
    variables are in the catalog's Vercel project (Production) and in
    `peptidecosta/.env.local` and `.env.production.local`. The Givver webhook
    ("Catalog payment notifications",
    `https://catalog.peptidescostarica.net/api/givver/webhook`,
    payment.succeeded + payment.failed, enabled) answered its **Send test
    event** with 200, and both webhook addresses refuse an unsigned request
    (400, re-checked 14 Nov). The website's synced copy of the checkout carries
    the new route too (`e372697a` on `main`), so nothing is left to do there.
    Checked against the live store before shipping: card and crypto pages open,
    ACH says "payments are unavailable" (hence `ACH_GATEWAY=chargx`), and our
    own `createChargxCardCheckout` produced a Givver page with the real key.
    **Still unproven: no real payment has gone through Givver.** The first real
    card order should read "Givver" as its Descriptor in the admin order panel;
    that store is also where its refund has to be made. The day Givver turns
    ACH on, drop the `ACH_GATEWAY` line and change nothing else.
11. Email campaign send speed (14 Nov 2026, catalog `899adf5d`, `c5f96021`,
    `c487d499`). A ~1,800-person send took ~8h. **Live now:** campaigns drain
    continuously instead of parking 30 min between batches, a started campaign
    finishes past the 20:00 window instead of rolling to next morning, and
    slow-reputation providers (Hotmail/Outlook/Live/MSN, iCloud/me/mac) send on
    a slow clock (~300/hr) while Gmail/rest go full speed — ~2,000 in <30 min.
    Pacing knobs (all server env, no deploy): `EMAIL_CAMPAIGN_BATCH_SIZE` (120),
    `EMAIL_CAMPAIGN_BATCH_INTERVAL_MINUTES` (0 — any value >0 re-adds the park),
    `EMAIL_CAMPAIGN_SEND_DELAY_MS` (800), `EMAIL_CAMPAIGN_SLOW_DOMAINS` (""=off),
    `EMAIL_CAMPAIGN_SLOW_SEND_DELAY_MS` (12000). **Shipped but OFF:** Elastic→
    Resend→Rackspace quota failover. To turn on: make a Resend account, verify
    peptidescostarica.net on it (add Resend's SPF include + DKIM at Namecheap),
    then set `EMAIL_CAMPAIGN_FALLBACK_ENABLED=true` + `RESEND_API_KEY` in Vercel
    (Rackspace valve reuses `OWN_DOMAIN_SMTP_*`, cap `EMAIL_CAMPAIGN_RACKSPACE_CAP`
    =200). Unproven: no live Resend account or real quota event tested; Elastic's
    quota-error wording is a best guess in `isQuotaExhausted`. **DNS (checked
    14 Nov):** peptidescostarica.net meets Gmail/Yahoo bulk rules (SPF has
    Elastic+Rackspace+Brevo, Elastic DKIM at `api._domainkey`, DMARC exists);
    owner to decide — add DMARC `rua` reporting then raise `p=none`→`quarantine`,
    and drop Brevo from SPF if unused. **Not done — Phase 3:** Resend *batch* API
    as the main send path (speed headroom + placement comparison), deferred to
    after Black Friday; the failover above is overflow-only, not Phase 3.
12. Order webhook for the media buyer (14 Nov 2026, branch
    `catalog-order-webhook-fields`, worktree `catalog-webhook`). He asked for a
    product slug, a plain `amount` + `currency`, the `cid` / `ttclid` click ids,
    an HMAC header and cancel/refund events; his receiver answers **422 when
    `cid` is missing**, so without the click ids no CR sale can be attributed at
    all. Built: `?cid=` / `?ttclid=` saved on the order like the landing ref, the
    new payload shape, `X-Webhook-Signature` (HMAC-SHA256 hex of the raw body),
    retries for network errors and 5xx (no retry on a 4xx — the refusal is
    logged with his own wording), and `order.cancelled` / `order.refunded` for
    orders that had already been reported as paid. Full contract to hand him:
    `docs/order-paid-webhook.md`. The website half is branch `main-click-ids`
    (worktree of the same name): `lib/site/attribution.mjs` saves `?cid=` /
    `?ttclid=` and sends them to checkout, and the synced checkout copy is
    re-synced from the catalog branch. He confirmed on 15 Nov: Costa Rica posts
    to the same endpoint (`https://usapeptidedepot.site/order_webhook.php`) with
    the same secret as the US, and his receiver now accepts a sale with no `cid`
    as long as `ref`/`lp` or `ttclid` is there. **Live since 15 Nov 2026:**
    `add-order-click-ids.sql` run by the owner, both branches pushed
    (`catalog` `77107e0a`, `main` `b209728b`, each a fast-forward of its own
    branch), and `ORDER_WEBHOOK_URL` + `ORDER_WEBHOOK_SECRET` set in the
    catalog's Vercel project (Production) — before that the webhook had never
    fired once. **Only paid-ad orders are sent** (owner, 15 Nov): an order must
    carry `ref`, `cid` or `ttclid`, so organic and WhatsApp sales never reach
    him; `ORDER_WEBHOOK_ALL_ORDERS=true` would send every one. **End-to-end proved
    15 Nov:** a hand-made test order `OMERTEST1` (₡100), signed with the live
    secret by the real code path, was first refused `401 bad signature`; he
    changed his verifier and the same POST was then accepted `200`. So our URL,
    secret and `X-Webhook-Signature` (HMAC-SHA256 hex of the raw body) are what
    he reads. Still unproven: no real
    paid order has gone to his endpoint yet — the first one is the proof, and
    its result is in the catalog's Vercel logs under `[order-paid-webhook]`.
    Not covered:
    WhatsApp sales, where no landing URL is ever loaded so there is no click id
    to send; the catalog's lead forms, which still keep Google clicks only; and
    the website's legacy-layout pages (blog, guides, legal), which are outside
    the new design's shell and so capture no attribution at all — an ad must
    land on the home page, a product page or a category page.
13. Flash sale naming (16 Nov 2026, Joey: "change this long offer name to
    simply Flash Sale"). Launching a flash sale saved its name as the whole
    product list — the live sitewide sale was called "20% off " plus 68 vials,
    which is what the dashboard, the activity log, the launch email subject and
    the announcement ticker all printed. Now the name is "Flash Sale" /
    "Oferta Relámpago", `dealBannerText` writes a flash banner from the offer
    instead of echoing the name (so it still states the discount and the real
    end time), and a one-line offer summary names three products and counts the
    rest. **Two branches, push both:** `fix/flash-sale-name` (catalog,
    worktree `catalog-flash-name`) and `fix/flash-sale-name-website` (main,
    worktree `main-flash-name`, the re-synced copy — it also carries the
    `orderPaidWebhook.mjs` paid-ad change from `9a1f1cff`, which had never been
    synced). No migration. The name of the sale running now does not change;
    only the next one launched. Not exercised: no flash sale has been launched
    from the admin with this code.
14. Revenue by channel (16 Nov 2026, Belhassen's brief + design; Joey's
    "source on every order"). Admin → Operations → **Revenue by channel**
    (module `revenue_channel`, grant it per person in Team Management). Every
    paid order counts once, in one of 13 channels (`src/lib/channelAttribution.mjs`),
    paid vs organic, last or first touch, new vs returning, ad spend + ROAS,
    tracking coverage, per-channel order list, CSV. Revenue rules are
    `orderRevenue.mjs`'s (checked on real orders: 9–15 Nov = $37,646.37, the
    same as the plain sum). How orders get a source: a `pcr_touch` cookie on
    .peptidescostarica.net (first + last non-direct visit, 90 days) read at
    checkout; a `Ref: PCR-…` on every tracked WhatsApp tap, copied onto the
    order staff later create for that phone by a DB trigger; the lead forms
    (and TikTok API leads) copied the same way; and a required "Where did this
    customer come from?" dropdown on hand-made orders. Branches
    `feat/revenue-by-channel` (catalog, worktree `catalog-revenue-channel`) and
    `feat/revenue-by-channel-website` (main, worktree `main-revenue-channel`:
    records visits into `pcr_touch`, sends it with orders and forms, re-synced
    checkout copy). **To ship, in this order:** run
    `add-order-channel-attribution.sql` in Supabase, push the catalog branch,
    then the website branch — never the website first: the old checkout saves
    an order as posted and would fail on the unknown `touch` key. Orders before
    that stay Unknown — no backfill is possible. The main site's WhatsApp
    buttons go through its own synced `/api/whatsapp/open/` (Ref + source,
    no catalog in the path); it saves only once the website's Vercel project
    has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, and until then
    just redirects to wa.me unchanged. Not done: Google Ads upload
    still sends only the click on `ad_attribution`; Meta Conversions API; a
    real CRM-wide light mode (the sidebar sun only flips this report — the rest
    of the admin is hard-coded dark).
15. Card decline rules shown to customers (17 Nov 2026): "3 tries, call your
    bank after the first decline, then card payment is blocked for 1 hour". On
    the catalog's checkout card panel, `/pay-card`, `/payment-help` and the
    "all 3 tries used" stop, and in the website cart's card option. The block
    itself was already there (`card-attempt-order`, 3 per order per hour) and
    is unchanged; the wording lives in `src/lib/cardDeclineRules.mjs` and a test
    fails if it drifts from the route. Branches `feat/card-decline-notice`
    (catalog) and `feat/card-decline-notice-website` (main, re-synced copy);
    push the catalog first. No migration. Not covered: the gateway's own card
    page (we cannot change it), the decline email and WhatsApp message.
16. Ad checkouts that never became orders (17 Nov 2026, media buyer's report:
    7 checkouts on 14–16 Nov, "buyers can't pay"). Found in the database: 1
    became an order (WhatsApp, cancelled by staff), the other 6 never reached
    the card page, so the gateway was not at fault. The website's checkout
    drawer stopped them without saying why: "Continue to checkout" was
    disabled (taps ignored, no message) until the research-use box was ticked,
    and a missing field's error printed below the fold. One Facebook-browser
    shopper also had 7 order attempts refused by the server on 15 Nov (reason
    only in Vercel logs, not checked). No order has ever come from the
    Instagram/Facebook in-app browser. **Fixed, two branches:**
    `fix/checkout-silent-blocks-website` (main, worktree
    `main-checkout-blocks`: the tap now outlines the box and says why, every
    error sits above the button and scrolls to its field, Spanish wording for
    four errors, and a higher server price is shown and accepted on the next
    press instead of being refused forever) and `feat/order-created-webhook`
    (catalog, worktree `catalog-order-created`: `order.created` sent to the
    media buyer when an ad order is saved, before payment, with the order
    number and `paymentMethod`; one try, 2.5s, never blocks checkout; contract
    in `docs/order-paid-webhook.md`). The website branch also carries the
    re-synced checkout copy. Push the catalog first. No migration, no new env
    var. Not exercised: the price-change path (localhost cannot submit
    orders), a real `order.created` reaching his endpoint, and the in-app
    browsers themselves.
17. Crypto off the checkout, Apple Pay its own option (17 Nov 2026, Joey:
    "crypto worthless, nobody uses", "separate cards and Apple Pay"). Both
    checkouts: the Crypto tile is gone, and Apple Pay is a new tile right
    after Card, shown only on a device that can pay with it
    (`ApplePaySession.canMakePayments()`). It is a card order (same gateway
    page, `payment_method: 'card'`); Apple Pay is tapped on Givver's page.
    The Card tile no longer shows the Apple Pay logo or name.
    `/pay-card?type=crypto` still works for links already sent. Branches
    `feat/apple-pay-tile` (catalog, worktree `catalog-apple-pay`) and
    `feat/apple-pay-tile-website` (main, worktree `main-apple-pay`, re-synced
    `catalog/globals.css`); push the catalog first. No migration, no env var.
    **Depends on Givver:** on 15 Nov Joey's Apple Pay tap landed on a plain
    card form because Givver's page did not offer Apple Pay; Givver said a fix
    ("Apple/Google Pay buttons at the top of the form on mobile") was local
    and coming. Until it ships, the Apple Pay tile leads to the card form. Not
    exercised: a real iPhone (tested with a faked device check) and a real
    payment.

Agents:
- Move the rest of the catalog-only back end to the website, one piece at a
  time, switching the catalog's copy off as each moves: deals/exchange
  rate/analytics/leads, then admin/CRM, WhatsApp bot, crons, ChargX webhook.
- Order emails load their logo from `catalog.peptidescostarica.net/logo.png`.
- Security: the anon key can read all `promo_codes`, including hidden ones
  (catalog RLS) — fix in the catalog.
- Shopper Approved display, the catalog's landing-page setting and GA4
  `sign_up` are not on the website yet.
- SEO, fixed 9 Nov 2026 on the website (branch `main`) (commits a5b1e1db, fae69bca;
  live once pushed). Rules for anyone touching SEO there:
  - **Canonical and hreflang** come from `lib/seo-links.mjs` (route map),
    never from WordPress's harvested `data/seo.json`: every page is its own
    canonical; language pairs only when both pages name each other; the 25
    `/product/lp-…/` ad copies canonicalise to the regular product and stay
    out of the sitemap. `tests/seo-links.test.mjs` checks every page.
  - **Structured data** comes from `lib/site/structured-data.mjs`, built from
    what each page shows (breadcrumb component, FAQ accordions, live prices).
    Never re-add WordPress's harvested JSON-LD (old prices, wrong URLs).
    `node scripts/check-structured-data.mjs <base>` audits every sitemap page
    (966/966 passed on a production build).
  - Owner QA: `peptidecosta-website/docs/seo/structured-data-qa.md` (Google
    Rich Results Test on 10 URLs, then Search Console → Enhancements).
  - Not covered: ~30 old-layout pages (spec sheets, two leftover affiliate
    pages, discontinued Pinealon/TB-4) carry no structured data.
