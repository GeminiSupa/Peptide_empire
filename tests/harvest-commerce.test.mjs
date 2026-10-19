import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { scrubUsdForPage, withoutHarvestedCommerce, withoutHarvestedGlobal } from '../lib/harvest-commerce.mjs';

test('old monetary claims disappear while ordinary content survives', () => {
  const page = {
    intro_en: 'A research product. Free shipping over ₡92,000.',
    sections: [
      { type: 'paragraph', content: { text_en: 'Price ₡75,900 per vial.' } },
      { type: 'paragraph', content: { text_en: 'Research details remain.' } },
      { type: 'list', content: { items_en: ['Item — ₡75,900'] } },
      { type: 'faq', content: { items: [
        { q_en: 'Price?', a_en: '₡75,900 per vial.' },
        { q_en: 'Storage?', a_en: 'Keep cool.' },
      ] } },
      { type: 'product_grid', content: { products: [{ name: 'Example', price: '₡75,900' }] } },
    ],
  };
  const clean = withoutHarvestedCommerce(page);
  assert.equal(clean.intro_en, 'A research product.');
  assert.deepEqual(clean.sections.map((section) => section.type), ['paragraph', 'faq', 'product_grid']);
  assert.deepEqual(clean.sections[1].content.items.map((item) => item.q_en), ['Storage?']);
  assert.equal(clean.sections[2].content.products[0].price, null);
});

test('mirrored WordPress media use this deployment', () => {
  const clean = withoutHarvestedCommerce({ html_en: '<img src="https://peptidescostarica.net/wp-content/uploads/test.webp">' });
  assert.equal(clean.html_en, '<img src="/wp-content/uploads/test.webp">');
});

test('imported pages are free of old catalog prices and shipping thresholds', async () => {
  const root = new URL('../data/pages/', import.meta.url);
  const files = (await readdir(root)).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(await readFile(new URL(file, root), 'utf8'));
    const scrubUsd = scrubUsdForPage(file.slice(0, -5), '/');
    const clean = withoutHarvestedCommerce(data, { scrubUsd });
    assert.equal(JSON.stringify(clean).includes('₡'), false, `${file} still has a harvested amount`);
    if (scrubUsd) assert.equal(/\$\s*\d/.test(JSON.stringify(clean)), false, `${file} still has an old dollar amount`);
    assert.equal(/https?:\/\/(?:www\.)?peptidescostarica\.net\/wp-content/i.test(JSON.stringify(clean)), false, `${file} still loads WordPress media`);
    assert.equal(clean.pages?.length, data.pages?.length, `${file} lost a page`);
  }
});

test('shipping policy and info center lose old dollar shipping thresholds', async () => {
  for (const [file, path] of [['legal', '/shipping-policy/'], ['guide', '/info-center/']]) {
    const data = JSON.parse(await readFile(new URL(`../data/pages/${file}.json`, import.meta.url), 'utf8'));
    const page = data.pages.find((item) => item.en === path);
    const clean = withoutHarvestedCommerce(page, { scrubUsd: scrubUsdForPage(file, path) });
    assert.equal(/\$\s*\d/.test(JSON.stringify(clean)), false, `${path} still has an old shipping threshold`);
    assert.ok(clean.sections.length > 0);
  }
});

test('global announcement does not promise an old shipping threshold', async () => {
  const global = JSON.parse(await readFile(new URL('../data/global.json', import.meta.url), 'utf8'));
  const clean = withoutHarvestedGlobal(global);
  assert.equal(JSON.stringify(clean).includes('₡'), false);
  assert.match(clean.announcement.text_en, /catalog/);
});
