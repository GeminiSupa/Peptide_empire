/**
 * The Google Ads lead tags in GTM fire on the /lp and /glp-1 thank-you URLs.
 * The pages therefore load GTM only for the first view right after a real form
 * submit, so a reload, bookmark or direct visit cannot count the lead again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const PAGES = ['../public/lp/thank-you.html', '../public/glp-1/thank-you.html'];

function gtmLoader(page) {
  const html = readFileSync(new URL(page, import.meta.url), 'utf8');
  const block = html.match(/<!-- Google Tag Manager[\s\S]*?<script>([\s\S]*?)<\/script>\s*<!-- End Google Tag Manager -->/);
  assert.ok(block, `${page}: GTM block not found`);
  return block[1];
}

/** Runs the head loader in a pretend browser; true if it would fetch gtm.js. */
function loadsGtm(page, stored) {
  const added = [];
  const store = new Map(stored === undefined ? [] : [['pcr_lead', typeof stored === 'string' ? stored : JSON.stringify(stored)]]);
  const document = {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: (el) => added.push(el.src) } }],
  };
  const window = {};
  vm.runInNewContext(gtmLoader(page), {
    window, document, Date,
    sessionStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null) },
  });
  return added.some((src) => String(src).includes('gtm.js?id=GTM-M2GVDQ44'));
}

for (const page of PAGES) {
  test(`${page}: GTM loads once, right after a real submit`, () => {
    assert.equal(loadsGtm(page, { ts: Date.now(), lead: {} }), true, 'first view after submit');
    assert.equal(loadsGtm(page, { ts: Date.now(), fired: true }), false, 'reload after the lead was counted');
    assert.equal(loadsGtm(page, undefined), false, 'direct visit or bookmark');
    assert.equal(loadsGtm(page, { ts: Date.now() - 31 * 60 * 1000 }), false, 'stale handoff (over 30 min)');
    assert.equal(loadsGtm(page, 'not json'), false, 'corrupt storage');
  });

  test(`${page}: the page still marks the lead fired, which is what stops the reload`, () => {
    const html = readFileSync(new URL(page, import.meta.url), 'utf8');
    assert.match(html, /var STORE = "pcr_lead";/);
    assert.match(html, /var MAX_AGE_MS = 30 \* 60 \* 1000;/);
    assert.match(html, /function markFired\(rec\)\{\s*rec\.fired = true;/);
    assert.equal((html.match(/gtm\.js\?id=/g) || []).length, 1, 'no second, unguarded GTM loader');
  });
}
