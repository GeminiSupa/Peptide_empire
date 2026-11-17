/**
 * The Google Ads landing pages served here at `/lp/<slug>/`.
 *
 * They were running on `catalog.peptidescostarica.net/lp/<slug>` and moved to
 * the main domain on 17 Nov 2026 (owner). Each is a copy of the catalog's file,
 * written by `scripts/sync-landing-pages.mjs`; these checks are what must stay
 * true of the copy, so a paid click always lands on a real page that can take
 * an order. Drift from the catalog is the sync script's `--check`, not this.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config, { AD_LANDING_PAGES } from '../next.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_ORIGIN = 'https://catalog.peptidescostarica.net';

const page = (slug) => path.join(ROOT, 'public', 'lp', slug, 'index.html');
const html = (slug) => fs.readFileSync(page(slug), 'utf8');

test('each landing page is here, with its tracking and its checkout', () => {
  assert.ok(AD_LANDING_PAGES.length >= 2, 'the pages are listed in next.config.mjs');
  for (const slug of AD_LANDING_PAGES) {
    assert.ok(fs.existsSync(page(slug)), `public/lp/${slug}/index.html exists`);
    const text = html(slug);

    // Tracking: without these the click is paid for and reports nothing.
    assert.ok(text.includes('GTM-M2GVDQ44'), `${slug} loads Tag Manager`);
    assert.ok(text.includes('captureGoogleAdClick'), `${slug} keeps the Google click ID`);
    assert.ok(text.includes('checkout_submit') && text.includes('user_data'), `${slug} sends checkout tracking`);

    // Checkout: the order is saved, and the research acknowledgement the
    // catalog requires is sent with it.
    assert.ok(text.includes('/api/orders/create'), `${slug} posts the order`);
    assert.ok(text.includes('research_ack'), `${slug} sends the research acknowledgement`);
    assert.ok(text.includes('/pay-card?order='), `${slug} continues to the card page`);

    // Live prices and stock, from this site's own endpoint.
    assert.ok(text.includes("fetch('/api/lp/products'"), `${slug} reads /api/lp/products from this site`);

    // Still the optimised file, not the 3.95 MB original.
    assert.ok(text.length < 800000, `${slug} is optimised (${text.length} bytes)`);
    assert.ok(!text.includes('data:image/webp;base64'), `${slug} embeds no WebP`);
    assert.ok(!text.includes('data:image/png;base64'), `${slug} embeds no PNG`);
  }
});

test('the money path goes to the catalog, as every order from this site does', () => {
  // This site posts public orders to the catalog's `/api/orders/create` and
  // sends card payments to its `/pay-card` (lib/storefront/catalog-origin.mjs,
  // and the owner's decision). These pages must do the same, not reach for a
  // same-origin route that is only live once NEXT_PUBLIC_OWN_CHECKOUT is set.
  for (const slug of AD_LANDING_PAGES) {
    const text = html(slug);
    assert.ok(text.includes(`fetch('${CATALOG_ORIGIN}/api/orders/create'`), `${slug} posts the order to the catalog`);
    assert.ok(!text.includes("fetch('/api/orders/create'"), `${slug} does not post the order to this site`);
    assert.ok(
      text.includes(`location.href = '${CATALOG_ORIGIN}/pay-card?order='`),
      `${slug} sends the card payment to the catalog`,
    );
    assert.ok(!text.includes("location.href = '/pay-card?order='"), `${slug} does not send it to this site`);
  }
});

test('each page names its address here as the original', () => {
  // The catalog serves the same file at its own address and has no robots.txt,
  // so both copies are crawlable; the canonical keeps one page in the index.
  for (const slug of AD_LANDING_PAGES) {
    assert.ok(
      html(slug).includes(`<link rel="canonical" href="https://peptidescostarica.net/lp/${slug}/">`),
      `${slug} is canonical here`,
    );
  }
});

test('each address serves its page itself, and never redirects', async () => {
  // The ads team's rule (13 Nov 2026): the address in the ad is the page, with
  // no hop between the paid click and the landing.
  const rewrites = await config.rewrites();
  const redirects = await config.redirects();
  for (const slug of AD_LANDING_PAGES) {
    const rule = rewrites.find((r) => r.source === `/lp/${slug}`);
    assert.ok(rule, `/lp/${slug}/ has no alias: it would 404`);
    assert.equal(rule.destination, `/lp/${slug}/index.html`, slug);
    assert.ok(!redirects.some((r) => r.source === `/lp/${slug}`), `${slug}: must answer 200, not redirect`);
  }
  // Bare /lp still goes to the home page; these pages sit under it.
  assert.ok(redirects.some((r) => r.source === '/lp' && r.destination === '/'), '/lp still redirects home');
});

test('every copied file is in the sync manifest, so --check covers it', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lp/.synced-files.json'), 'utf8'));
  const files = new Set(manifest.files);
  for (const slug of AD_LANDING_PAGES) assert.ok(files.has(`public/lp/${slug}/index.html`), slug);
  // The images every page draws, hero and logo included.
  assert.ok(files.has('public/lp-assets/icons/logo-new.webp'), 'the logo is copied');
  assert.ok([...files].filter((f) => f.startsWith('public/lp-assets/')).length > 50, 'the product photos are copied');
  for (const file of files) assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is on disk`);
});

test('this site answers /api/lp/products itself', () => {
  const route = fs.readFileSync(path.join(ROOT, 'app/api/lp/products/route.js'), 'utf8');
  assert.ok(route.includes('getLandingPageProducts'), 'it reads the live rows');
  // The pages only replace their snapshot when the body says dbBacked.
  assert.ok(route.includes('dbBacked: true'), 'a good answer is marked dbBacked');
});

test('each page keeps the ad click ids and the visit source, and sends them with the order', () => {
  // The order goes to the catalog's address, where the browser sends no
  // cookie, so the page carries the source itself (17 Nov 2026).
  for (const slug of AD_LANDING_PAGES) {
    const text = html(slug).replace(/\r\n/g, '\n');
    for (const key of ['landing_ref', 'landing_cid', 'landing_ttclid']) {
      assert.ok(text.includes(`    ${key}: window.LP_TESTING ? null : window.lpLanding("${key}")`), `${slug} sends ${key}`);
    }
    assert.ok(text.includes('fetch("/api/lp/touch/", { method: "POST"'), `${slug} records the visit's source here`);
    assert.ok(text.includes('    touch: window.LP_TESTING ? null : (window.lpTouchState || null)'), `${slug} sends the source with the order`);
    assert.ok(text.includes('function wa(msg) { return "/api/whatsapp/open/?phone="'), `${slug} WhatsApp taps are tracked`);
    assert.ok(text.includes('Spanish for the ad pages'), `${slug} reads in Spanish`);
    // This site loads no TikTok pixel and adds none without the owner (README).
    assert.ok(!text.includes('ttq.load') && !text.includes('TikTok pixel'), `${slug} carries no TikTok pixel`);
  }
  const route = fs.readFileSync(path.join(ROOT, 'app/api/lp/touch/route.js'), 'utf8');
  assert.ok(route.includes("from '@/lib/catalog-attribution/touchTracker.mjs'"), 'the catalog\'s own touch code');
  assert.ok(route.includes('NextResponse.json({ touch: state || null }'), 'hands the source back to the page');
});
