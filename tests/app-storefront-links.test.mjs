import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { APP_STOREFRONT_URL, appStorefrontHref } from '../src/lib/appStorefront.js';

test('app links carry source, campaign, and language', () => {
  const href = appStorefrontHref({ source: 'nav', lang: 'en' });
  assert.equal(href.startsWith(`${APP_STOREFRONT_URL}/?`), true);
  assert.match(href, /utm_source=nav/);
  assert.match(href, /utm_medium=web/);
  assert.match(href, /utm_campaign=app_launch/);
  assert.match(href, /lang=en/);
});

test('catalog, site chrome, and thank-you all point at the shared app helper', async () => {
  const files = [
    '../src/app/catalog/page.js',
    '../src/components/StorefrontChrome.js',
    '../src/app/thank-you/page.js',
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /appStorefrontHref/, `${file} should use appStorefrontHref`);
  }
});
