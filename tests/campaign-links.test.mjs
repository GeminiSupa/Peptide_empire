import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignDestination, decodeUrlAmpersands } from '../src/lib/campaignLinks.mjs';

const DOMAIN = 'https://catalog.peptidescostarica.net';
const ID = '7939cbb4-a81e-43f6-bb31-2d9dba6c9aac';

test('the real bigpharma_nov link keeps its own UTM tags with no amp; leftovers', () => {
  const href = 'https://catalog.peptidescostarica.net/catalog?utm_source=email&amp;utm_medium=email&amp;utm_campaign=bigpharma_nov';
  const out = buildCampaignDestination(href, ID, DOMAIN);
  assert.equal(out, 'https://catalog.peptidescostarica.net/catalog?utm_source=email&utm_medium=email&utm_campaign=bigpharma_nov');
  assert.ok(!out.includes('amp;'));
  const params = new URL(out).searchParams;
  assert.equal(params.getAll('utm_campaign').length, 1);
  assert.equal(params.get('utm_campaign'), 'bigpharma_nov');
});

test('a link with no UTM tags still gets the three standard ones', () => {
  const out = buildCampaignDestination('https://catalog.peptidescostarica.net/catalog', ID, DOMAIN);
  assert.equal(out, `https://catalog.peptidescostarica.net/catalog?utm_source=email&utm_medium=campaign&utm_campaign=${ID}`);
});

test('relative links are made absolute, and other query params are preserved', () => {
  const out = buildCampaignDestination('/catalog?category=glp&amp;sort=new', ID, DOMAIN);
  assert.equal(out, `${DOMAIN}/catalog?category=glp&sort=new&utm_source=email&utm_medium=campaign&utm_campaign=${ID}`);
});

test('only the missing UTM tags are added', () => {
  const out = buildCampaignDestination('https://example.com/p?utm_source=newsletter', ID, DOMAIN);
  assert.equal(out, `https://example.com/p?utm_source=newsletter&utm_medium=campaign&utm_campaign=${ID}`);
});

test('a #fragment stays at the end instead of swallowing the UTM tags', () => {
  const out = buildCampaignDestination('https://example.com/p#reviews', ID, DOMAIN);
  assert.equal(out, `https://example.com/p?utm_source=email&utm_medium=campaign&utm_campaign=${ID}#reviews`);
});

test('double-encoded and numeric ampersands decode to one &', () => {
  assert.equal(decodeUrlAmpersands('a?x=1&amp;amp;y=2&#38;z=3&#x26;w=4'), 'a?x=1&y=2&z=3&w=4');
});
