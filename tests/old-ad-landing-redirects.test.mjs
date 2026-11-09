/**
 * Google Ads still sends clicks to five old WordPress landing pages. Each must
 * redirect to this site's page for the same product (which saves the Google
 * click ID), and the live /lp-glutathione/ page must not be caught.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import config, { OLD_AD_LANDING_PAGES } from '../next.config.mjs';

const EXPECTED = {
  'lp-klow-80mg': '/product/lp-klow-80mg/',
  'lp-bac-water-10ml': '/product/bac-water-10ml/',
  'lp-aicar-50mg': '/product/lp-aicar-50mg/',
  'lp-oxytocin-acetate-5mg': '/product/lp-oxytocin-acetate-5mg/',
  'lp-pt-141-10mg': '/product/lp-pt-141-10mg/',
};

test('each old ad landing page redirects to its own product page', async () => {
  const rules = await config.redirects();
  assert.deepEqual(Object.fromEntries(OLD_AD_LANDING_PAGES), EXPECTED);
  for (const [page, destination] of Object.entries(EXPECTED)) {
    const rule = rules.find((r) => r.source === `/${page}`);
    assert.ok(rule, `${page}: redirect rule missing`);
    assert.equal(rule.destination, destination, page);
    assert.equal(rule.permanent, false, `${page}: temporary, so the old page can come back`);
  }
});

test('live pages are not caught by the old ad redirects', async () => {
  const rules = await config.redirects();
  for (const live of ['/lp-glutathione', '/product/lp-klow-80mg']) {
    assert.ok(!rules.some((r) => r.source === live), live);
  }
});
