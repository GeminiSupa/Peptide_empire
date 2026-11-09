import test from 'node:test';
import assert from 'node:assert/strict';
import {
  articleNode, breadcrumbNode, collectionNodes, faqNode, graph, jsonLdText, organizationNode, websiteNode,
} from '../lib/site/structured-data.mjs';
import { productSchema } from '../lib/site/product-schema.mjs';

const base = 'https://peptidescostarica.net';

test('breadcrumbs run 1..n with absolute URLs and end at the page itself', () => {
  const node = breadcrumbNode({
    base,
    url: '/product/bpc-157-10mg/',
    items: [{ name: 'Home', href: '/' }, { name: 'Healing', href: '/peptides-for-healing/' }, { name: 'BPC-157' }],
  });
  assert.deepEqual(node.itemListElement.map((i) => i.position), [1, 2, 3]);
  assert.equal(node.itemListElement[0].item, `${base}/`);
  assert.equal(node.itemListElement[2].item, `${base}/product/bpc-157-10mg/`);
});

test('a single crumb is not a breadcrumb', () => {
  assert.equal(breadcrumbNode({ base, url: '/', items: [{ name: 'Home' }] }), null);
});

test('several accordions on one page become one FAQPage, de-duplicated, as plain text', () => {
  const node = faqNode({
    base,
    url: '/x/',
    lists: [
      [['How fast is delivery?', '<p>2–4 days.</p>'], ['Is it tested?', 'Yes &amp; documented.']],
      [['How fast is delivery?', 'duplicate'], ['', 'no question'], ['No answer', '']],
    ],
  });
  assert.equal(node['@type'], 'FAQPage');
  assert.deepEqual(node.mainEntity.map((q) => q.name), ['How fast is delivery?', 'Is it tested?']);
  assert.equal(node.mainEntity[0].acceptedAnswer.text, '2–4 days.');
  assert.equal(node.mainEntity[1].acceptedAnswer.text, 'Yes & documented.');
  assert.equal(faqNode({ base, url: '/x/', lists: [[]] }), null);
});

test('the organization uses the admin contact details and the site logo', () => {
  const node = organizationNode({ base, contact: { phoneCr: '+506 6060-4775', phoneUs: '+1 831 471 5559', email: 'info@peptidescostarica.net' }, sameAs: ['https://x.com/a'] });
  assert.equal(node['@id'], `${base}/#organization`);
  assert.equal(node.logo.url, `${base}/logo.png`);
  assert.equal(node.telephone, '+506 6060-4775');
  assert.equal(node.contactPoint.length, 2);
  assert.deepEqual(node.sameAs, ['https://x.com/a']);
  assert.equal(websiteNode({ base, lang: 'es' }).url, `${base}/es/`);
});

test('collection pages list only real product URLs', () => {
  const [page, list] = collectionNodes({
    base, url: '/shop/', name: 'Shop', lang: 'en',
    products: [{ name: 'A', href: '/a-costa-rica/' }, { name: 'B', href: '/all-peptide-products-costa-rica/?q=b' }],
  });
  assert.equal(page['@type'], 'CollectionPage');
  assert.equal(page.mainEntity['@id'], list['@id']);
  assert.deepEqual(list.itemListElement.map((i) => i.url), [`${base}/a-costa-rica/`]);
});

test('articles carry WordPress dates only when they exist', () => {
  const dated = articleNode({ base, url: '/blog/x/', headline: 'X', lang: 'en', dates: { published: '2026-09-21T03:17:07Z' } });
  assert.equal(dated.datePublished, '2026-09-21T03:17:07Z');
  assert.equal('dateModified' in dated, false);
  assert.equal('datePublished' in articleNode({ base, url: '/blog/y/', headline: 'Y', lang: 'en' }), false);
});

test('product offers use the colón price the page shows', () => {
  const schema = productSchema({
    compound: { name: 'Selank', variants: [{ size: '10 mg', priceUsd: 90, priceCrc: 40733, inStock: true }] },
    shelf: 'Other',
    schemaUrl: `${base}/selank-costa-rica/`,
    exchangeRate: 450,
  });
  assert.equal(schema.offers[0].price, 40733);
  assert.equal(schema.offers[0].url, `${base}/selank-costa-rica/`);
});

test('JSON-LD text cannot close its script tag', () => {
  const text = jsonLdText(graph([{ '@type': 'Thing', name: '</script><script>alert(1)</script>' }]));
  assert.equal(text.includes('</script>'), false);
  assert.equal(JSON.parse(text)['@graph'][0].name, '</script><script>alert(1)</script>');
});
