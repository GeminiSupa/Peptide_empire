/**
 * WordPress served every ad copy at two addresses: `/lp-<slug>/` and
 * `/product/lp-<slug>/`. Only the second one survived the 9 Nov 2026 move, so
 * an ad still pointing at the short address 404s and the click is paid for and
 * lost. They were being found one at a time as Google Ads reported them, which
 * is how two more reached us on 13 Nov 2026; these checks cover the whole
 * family at once instead, and the live /lp-glutathione/ page must not be caught.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config, { OLD_AD_LANDING_PAGES } from '../next.config.mjs';

const routes = JSON.parse(readFileSync(new URL('../data/routes.json', import.meta.url), 'utf8'));
const paths = new Set((routes.routes || routes).map((route) => route.en).filter(Boolean));
const adCopies = [...paths].filter((path) => /^\/product\/lp-[^/]+\/$/.test(path));
const redirected = new Map(OLD_AD_LANDING_PAGES);

test('every ad copy is reachable at its old short address too', () => {
  assert.ok(adCopies.length > 20, 'the ad copies are still in the route inventory');
  for (const copy of adCopies) {
    const short = copy.replace('/product/', '').replace(/\/$/, '');
    assert.ok(redirected.has(short), `/${short}/ 404s: add it to OLD_AD_LANDING_PAGES`);
  }
});

test('each old ad landing page redirects to a page that exists', async () => {
  const rules = await config.redirects();
  for (const [page, destination] of OLD_AD_LANDING_PAGES) {
    assert.ok(paths.has(destination), `${page}: ${destination} is not a page on this site`);
    const rule = rules.find((r) => r.source === `/${page}`);
    assert.ok(rule, `${page}: redirect rule missing`);
    assert.equal(rule.destination, destination, page);
    assert.equal(rule.permanent, false, `${page}: temporary, so the old page can come back`);
  }
  // Not every old address has an ad copy of its own: this one goes to the
  // regular product, and that is deliberate.
  assert.equal(redirected.get('lp-bac-water-10ml'), '/product/bac-water-10ml/');
});

test('live pages are not caught by the old ad redirects', async () => {
  const rules = await config.redirects();
  for (const live of ['/lp-glutathione', '/product/lp-klow-80mg']) {
    assert.ok(!rules.some((r) => r.source === live), live);
  }
});
