import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildShopperApprovedRecord,
  shopperApprovedConfig,
  shopperApprovedDisplayConfig,
  shopperApprovedFeedCsv,
  shopperApprovedFeedRows,
  shopperApprovedProductId,
  shopperApprovedProducts,
  shopperApprovedReviewPageScriptUrl,
  shopperApprovedScriptUrl,
  shopperApprovedSealImageUrl,
  shopperApprovedSiteId,
  shopperApprovedValues,
} from '../src/lib/shopperApproved.mjs';

const env = {
  SHOPPER_APPROVED_SITE_ID: '29967',
  SHOPPER_APPROVED_SURVEY_TOKEN: '90cSXD5t',
  SHOPPER_APPROVED_API_TOKEN: 'this-must-never-be-used',
};

test('a missing or malformed setting means no survey', () => {
  assert.equal(shopperApprovedConfig({}), null);
  assert.equal(shopperApprovedConfig({ SHOPPER_APPROVED_SITE_ID: '29967' }), null);
  assert.equal(shopperApprovedConfig({ SHOPPER_APPROVED_SURVEY_TOKEN: '90cSXD5t' }), null);
  assert.equal(shopperApprovedConfig({ ...env, SHOPPER_APPROVED_SITE_ID: 'not-a-number' }), null);
  assert.equal(shopperApprovedConfig({ ...env, SHOPPER_APPROVED_SURVEY_TOKEN: 'has space' }), null);
  assert.equal(shopperApprovedConfig({ ...env, SHOPPER_APPROVED_SURVEY_TOKEN: '<script>' }), null);
});

test('the API token is never part of the survey config', () => {
  const config = shopperApprovedConfig(env);
  assert.deepEqual(config, { siteId: '29967', token: '90cSXD5t' });
  assert.equal(JSON.stringify(config).includes('this-must-never-be-used'), false);
});

test('checkout records the order without putting the email in a URL', () => {
  const record = buildShopperApprovedRecord({
    orderId: ' PCR-10428 ',
    email: ' Ana@Example.com ',
    name: ' Ana Solis ',
  });
  assert.deepEqual(record, {
    orderId: 'PCR-10428',
    email: 'ana@example.com',
    name: 'Ana Solis',
  });
});

test('a real order becomes the values their script reads', () => {
  const values = shopperApprovedValues({
    siteId: env.SHOPPER_APPROVED_SITE_ID,
    token: env.SHOPPER_APPROVED_SURVEY_TOKEN,
    record: buildShopperApprovedRecord({
      orderId: 'PCR-10428',
      email: 'ana@example.com',
      name: 'Ana Solis',
    }),
  });
  assert.deepEqual(values, {
    site: 29967,
    token: '90cSXD5t',
    orderid: 'PCR-10428',
    email: 'ana@example.com',
    name: 'Ana Solis',
  });
  assert.equal(
    shopperApprovedScriptUrl(values.site),
    'https://www.shopperapproved.com/thankyou/rate/29967.js',
  );
});

test('a thank-you page opened with no purchase is not asked', () => {
  const args = {
    siteId: env.SHOPPER_APPROVED_SITE_ID,
    token: env.SHOPPER_APPROVED_SURVEY_TOKEN,
  };
  assert.equal(shopperApprovedValues({ ...args, record: { orderId: '', email: 'a@b.com' } }), null);
  assert.equal(shopperApprovedValues({ ...args, record: { orderId: 'PCR-1', email: 'nope' } }), null);
  assert.equal(shopperApprovedValues({ ...args, record: {} }), null);
  assert.equal(shopperApprovedScriptUrl('29967/evil'), null);
});

test('the survey token is not written into the source', async () => {
  const layout = await readFile(new URL('../src/app/thank-you/layout.js', import.meta.url), 'utf8');
  const survey = await readFile(new URL('../src/components/ShopperApprovedSurvey.js', import.meta.url), 'utf8');
  assert.match(layout, /shopperApprovedConfig\(\)/);
  assert.doesNotMatch(layout, /NEXT_PUBLIC_SHOPPER_APPROVED/);
  assert.doesNotMatch(survey, /process\.env/);
  assert.doesNotMatch(survey, /SHOPPER_APPROVED_API_TOKEN/);
  assert.doesNotMatch(`${layout}\n${survey}`, /90cSXD5t|29967/);
});

test('display widgets need only the site id', () => {
  assert.equal(shopperApprovedSiteId({}), null);
  assert.equal(shopperApprovedSiteId({ SHOPPER_APPROVED_SITE_ID: '29967' }), '29967');
  assert.equal(shopperApprovedConfig({ SHOPPER_APPROVED_SITE_ID: '29967' }), null);

  const display = shopperApprovedDisplayConfig({ SHOPPER_APPROVED_SITE_ID: '29967' });
  assert.deepEqual(display, {
    siteId: '29967',
    certificateUrl: 'https://www.shopperapproved.com/reviews/peptidescostarica.net/',
    reviewPagePreset: 'default',
  });
  assert.equal(
    shopperApprovedReviewPageScriptUrl(display.siteId),
    'https://www.shopperapproved.com/widgets/29967/merchant/review-page/default.js',
  );
  assert.equal(
    shopperApprovedSealImageUrl(display.siteId),
    'https://www.shopperapproved.com/seals/29967-m.gif',
  );
  assert.equal(JSON.stringify(display).includes('90cSXD5t'), false);
  assert.equal(JSON.stringify(display).includes('this-must-never-be-used'), false);
});

test('display API and reviews page never expose the survey token', async () => {
  const api = await readFile(new URL('../src/app/api/shopper-approved/display/route.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/app/reviews/page.js', import.meta.url), 'utf8');
  const seal = await readFile(new URL('../src/components/ShopperApprovedSeal.js', import.meta.url), 'utf8');
  const widget = await readFile(new URL('../src/components/ShopperApprovedReviewsWidget.js', import.meta.url), 'utf8');
  const blob = `${api}\n${page}\n${seal}\n${widget}`;
  assert.match(api, /shopperApprovedDisplayConfig/);
  assert.match(page, /shopperApprovedDisplayConfig/);
  assert.doesNotMatch(blob, /SHOPPER_APPROVED_SURVEY_TOKEN|SHOPPER_APPROVED_API_TOKEN|90cSXD5t/);
  assert.doesNotMatch(blob, /NEXT_PUBLIC_SHOPPER_APPROVED/);
  // Their overlay script must not be loaded; seal is a static link to /reviews.
  assert.doesNotMatch(seal, /shopperApprovedCertificateScriptUrl|className=\{`shopperlink/);
  assert.match(seal, /\/reviews/);
});

test('the thank-you page names what was bought, by the ids the feed uses', () => {
  const record = buildShopperApprovedRecord({
    orderId: 'PCR-1',
    email: 'a@b.com',
    products: ['GHK-Cu 50mg', 'GLP-1 12mg', ' GHK-Cu 50mg ', '', null],
  });
  assert.deepEqual(record.products, ['GHK-Cu 50mg', 'GLP-1 12mg']);
  assert.deepEqual(shopperApprovedProducts(record), {
    'ghk-cu-50mg': 'GHK-Cu 50mg',
    'glp-1-12mg': 'GLP-1 – Triple Agonist 12mg',
  });

  // No products, no bolt-on — and the record keeps its old shape.
  assert.equal(shopperApprovedProducts(buildShopperApprovedRecord({ orderId: 'PCR-1', email: 'a@b.com' })), null);
  assert.equal(shopperApprovedProducts({}), null);
});

test('feed ids match the thank-you ids, and every field is safe CSV', () => {
  const rows = shopperApprovedFeedRows([
    { product: 'GHK-Cu 50mg', imageUrl: '/ghk.png' },
    { product: 'GHK-Cu 100mg', imageUrl: 'https://cdn.example.com/ghk100.png' },
    { product: 'HGH 50 IU (Pfizer, Genotropin)' },
    { product: 'GHK-CU 50MG' },
  ], 'https://catalog.peptidescostarica.net/');

  assert.deepEqual(rows.map((r) => r.id), ['ghk-cu-50mg', 'ghk-cu-100mg', 'hgh-50-iu-pfizer-genotropin']);
  assert.equal(rows[0].id, shopperApprovedProductId('GHK-Cu 50mg'));
  assert.equal(rows[0].mpn, rows[0].id);
  // Not in a Google Shopping feed, so the Google ID is the MPN.
  assert.equal(rows[0].google_id, rows[0].mpn);
  assert.equal(rows[0].item_group_id, rows[1].item_group_id);
  assert.equal(rows[0].link, 'https://catalog.peptidescostarica.net/catalog/ghk-cu-50mg');
  assert.equal(rows[0].image_link, 'https://catalog.peptidescostarica.net/ghk.png');
  assert.equal(rows[1].image_link, 'https://cdn.example.com/ghk100.png');

  const csv = shopperApprovedFeedCsv(rows);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'id,title,link,image_link,brand,mpn,gtin,item_group_id,google_id');
  assert.equal(lines.length, 4);
  assert.match(lines[3], /"HGH 50 IU \(Pfizer, Genotropin\)"/);
});

test('all catalog payment paths hand the products to the thank-you page', async () => {
  const catalog = await readFile(new URL('../src/app/catalog/page.js', import.meta.url), 'utf8');
  const payCard = await readFile(new URL('../src/app/pay-card/page.js', import.meta.url), 'utf8');
  const payBank = await readFile(new URL('../src/app/pay-bank/page.js', import.meta.url), 'utf8');
  const bankApi = await readFile(new URL('../src/app/api/bank-payments/order/route.js', import.meta.url), 'utf8');
  const survey = await readFile(new URL('../src/components/ShopperApprovedSurvey.js', import.meta.url), 'utf8');
  assert.match(catalog, /products: cart\.map\(\(item\) => item\.product\)/);
  assert.match(payCard, /products: \(order\.items \|\| \[\]\)/);
  assert.ok(payCard.indexOf('stashShopperApprovedReview();') < payCard.indexOf('hostedPaymentWindow.location.href = data.paymentUrl'));
  assert.match(payBank, /buildShopperApprovedRecord\(result\.review\)/);
  assert.match(bankApi, /customer_name,customer_email,items/);
  assert.match(bankApi, /filter\(item => Number\(item\?\.price\) > 0\)/);
  // Set before their script is added, which is what their guide requires.
  assert.ok(survey.indexOf('window.sa_products') < survey.indexOf('document.head.appendChild(script)'));
});
