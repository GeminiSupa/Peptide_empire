import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ATTRIBUTION_KEYS,
  captureAttribution,
  leadAttribution,
  orderAttribution,
} from '../lib/site/attribution.mjs';

const UUID = '3f2b8c1e-5d4a-4b6f-9c2d-1a2b3c4d5e6f';
const UUID2 = '7a1c2e3f-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);

function fakeWindow(url, { referrer = '', cookie = '' } = {}) {
  const data = new Map();
  const jar = new Map();
  for (const part of cookie.split(';').map((s) => s.trim()).filter(Boolean)) {
    const at = part.indexOf('=');
    jar.set(part.slice(0, at), part.slice(at + 1));
  }
  const parsed = new URL(url);
  return {
    location: { search: parsed.search, hostname: parsed.hostname, protocol: parsed.protocol },
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
    document: {
      referrer,
      get cookie() {
        return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
      },
      set cookie(value) {
        const [pair] = value.split(';');
        const at = pair.indexOf('=');
        jar.set(pair.slice(0, at).trim(), pair.slice(at + 1));
      },
    },
    data,
  };
}

test('an agent link credits the order to that agent', () => {
  const win = fakeWindow('https://new.peptidescostarica.net/shop/?sales_agent=maria');
  captureAttribution(win, NOW);
  assert.equal(win.data.get(ATTRIBUTION_KEYS.salesAgent), 'maria');
  assert.equal(orderAttribution(win, NOW).sales_agent, 'maria');
});

test('a Google Ads click reaches the order as the catalog stores it', () => {
  const win = fakeWindow('https://new.peptidescostarica.net/?gclid=Cj0KCQabc-123&utm_source=google&utm_medium=cpc&utm_campaign=Brand%20CR');
  captureAttribution(win, NOW);
  const order = orderAttribution(win, NOW);
  assert.deepEqual(order.ad_attribution, { clicked_at: NOW, gclid: 'Cj0KCQabc-123' });
  assert.equal(order.utm_campaign, 'Brand CR');
  // A free-text campaign name never reaches a uuid column.
  assert.equal(order.campaign_id, undefined);
  assert.equal(win.data.has(ATTRIBUTION_KEYS.campaign), false);
});

test('an email journey link is kept for 30 days, then dropped', () => {
  const win = fakeWindow(`https://new.peptidescostarica.net/?utm_source=journey&utm_medium=email&utm_campaign=${UUID}&journey_enrollment=${UUID2}&utm_content=nope`);
  captureAttribution(win, NOW);
  const order = orderAttribution(win, NOW);
  assert.equal(order.journey_id, UUID);
  assert.equal(order.journey_enrollment_id, UUID2);
  assert.equal(order.journey_step_id, null, 'a malformed step id is dropped, not sent');
  assert.equal(order.campaign_id, undefined);

  const later = orderAttribution(win, NOW + 31 * 86400000);
  assert.equal(later.journey_id, undefined);
});

test('a broadcast campaign link sends campaign_id', () => {
  const win = fakeWindow(`https://new.peptidescostarica.net/?utm_source=email&utm_medium=campaign&utm_campaign=${UUID}`);
  captureAttribution(win, NOW);
  assert.equal(orderAttribution(win, NOW).campaign_id, UUID);
});

test('GA4 client and session ids are read off the Google cookies', () => {
  const win = fakeWindow('https://new.peptidescostarica.net/', {
    cookie: '_ga=GA1.1.123456789.1700000000; _ga_ABC123=GS2.1.s1762344000$o1$g1',
  });
  const order = orderAttribution(win, NOW);
  assert.equal(order.ga_client_id, '123456789.1700000000');
  assert.equal(order.ga_session_id, '1762344000');
});

test('orders carry only fields the catalog checkout already writes', () => {
  // /api/orders/create inserts the order as sent; an unknown column fails it.
  const allowed = new Set([
    'sales_agent', 'journey_id', 'journey_enrollment_id', 'journey_step_id', 'campaign_id',
    'utm_campaign', 'ad_attribution', 'ga_client_id', 'ga_session_id',
  ]);
  const win = fakeWindow(`https://new.peptidescostarica.net/?sales_agent=a&gclid=x1&utm_source=google&utm_medium=cpc&utm_campaign=${UUID}&fbclid=zz&ref=bob`, {
    cookie: '_ga=GA1.1.123456789.1700000000',
  });
  captureAttribution(win, NOW);
  for (const key of Object.keys(orderAttribution(win, NOW))) {
    assert.ok(allowed.has(key), `${key} is not a field the catalog checkout sends`);
  }
});

test('leads carry their campaign tags and referrer', () => {
  const win = fakeWindow('https://new.peptidescostarica.net/contact/?utm_source=facebook&utm_medium=paid&utm_campaign=oct', {
    referrer: 'https://www.facebook.com/',
  });
  captureAttribution(win, NOW);
  assert.deepEqual(leadAttribution(win), {
    utm_source: 'facebook',
    utm_medium: 'paid',
    utm_campaign: 'oct',
    referrer: 'https://www.facebook.com/',
  });

  const referred = fakeWindow('https://new.peptidescostarica.net/?ref=bob');
  captureAttribution(referred, NOW);
  assert.equal(leadAttribution(referred).referrer, 'affiliate:bob');
});

test('a visit with nothing to record records nothing and never throws', () => {
  const win = fakeWindow('https://new.peptidescostarica.net/', { referrer: 'https://new.peptidescostarica.net/shop/' });
  captureAttribution(win, NOW);
  assert.equal(win.data.size, 0);
  assert.deepEqual(leadAttribution(win), {});
  assert.deepEqual(orderAttribution(win, NOW), { ad_attribution: null });
  assert.doesNotThrow(() => captureAttribution(null));
  assert.deepEqual(orderAttribution(null), {});
});

// ── The vendored copies must stay byte-identical to the catalog's ──────────

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG_LIB = join(here, '..', '..', 'peptidecosta', 'src', 'lib');
const VENDORED = join(here, '..', 'lib', 'catalog-attribution');
const COPIES = ['adClickAttribution.mjs', 'gaIdentity.mjs', 'orderAttribution.mjs'];

async function readOrNull(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

const digest = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

test('the vendored attribution modules match the catalog\'s', async (t) => {
  if (await readOrNull(join(CATALOG_LIB, 'adClickAttribution.mjs')) === null) {
    t.skip(`catalog checkout not found at ${CATALOG_LIB} — nothing to compare against`);
    return;
  }
  for (const name of COPIES) {
    const ours = await readOrNull(join(VENDORED, name));
    const theirs = await readOrNull(join(CATALOG_LIB, name));
    assert.ok(ours !== null && theirs !== null, `${name} is missing on one side`);
    assert.equal(digest(ours), digest(theirs), `lib/catalog-attribution/${name} has drifted from the catalog's. Re-copy it.`);
  }
});

test('a lead from an ad carries the Google click, so the CRM order can be credited to it', () => {
  const win = fakeWindow('https://peptidescostarica.net/?gclid=Cj0KCQlead-1&utm_source=google&utm_medium=cpc');
  captureAttribution(win, NOW);
  assert.deepEqual(leadAttribution(win, NOW).ad_attribution, { clicked_at: NOW, gclid: 'Cj0KCQlead-1' });
  // Expired after Google's 90 days, and absent when there was no ad click.
  assert.equal(leadAttribution(win, NOW + 91 * 86400000).ad_attribution, undefined);
  const organic = fakeWindow('https://peptidescostarica.net/');
  captureAttribution(organic, NOW);
  assert.equal('ad_attribution' in leadAttribution(organic, NOW), false);
});
