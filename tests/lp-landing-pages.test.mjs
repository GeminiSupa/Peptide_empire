import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productNameResolver } from '../src/lib/authoritativeCheckout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('landing page product aliases resolve correctly in authoritative checkout', () => {
  const catalogProducts = [
    { product: 'Tirzepatide 10mg', price_usd: 140 },
    { product: 'Tirzepatide 20mg', price_usd: 240 },
    { product: 'Semaglutide 10mg', price_usd: 180 },
    { product: 'Retatrutide 20mg', price_usd: 220 },
    { product: '5-Amino-1MQ 50mg', price_usd: 90 },
    { product: 'BAC Water 3ml', price_usd: 9 },
  ];

  const resolver = productNameResolver(catalogProducts);

  assert.equal(resolver('GLP-1 (TRZ) 10mg')?.product, 'Tirzepatide 10mg');
  assert.equal(resolver('GLP-1 (TRZ) 20mg')?.product, 'Tirzepatide 20mg');
  assert.equal(resolver('GLP-1 (SEM) 10mg')?.product, 'Semaglutide 10mg');
  assert.equal(resolver('GLP-1 (RT) 20mg')?.product, 'Retatrutide 20mg');
  assert.equal(resolver('GLP-1 (RT) 20 mg')?.product, 'Retatrutide 20mg', 'the size format the page sends');
  assert.equal(resolver('GLP-1 20mg'), null, 'a bare GLP-1 name is not guessed');
  assert.equal(resolver('5-Amino-1MQ 50mg')?.product, '5-Amino-1MQ 50mg');
  assert.equal(resolver('BAC Water 3ml')?.product, 'BAC Water 3ml');
});

test('landing page static files are clean, asset-optimized and have tracking', () => {
  const glpPath = path.join(rootDir, 'public/lp/glp-1/index.html');
  const bacPath = path.join(rootDir, 'public/lp/bac-water/index.html');

  assert.ok(fs.existsSync(glpPath), 'GLP-1 HTML file exists');
  assert.ok(fs.existsSync(bacPath), 'BAC Water HTML file exists');

  const glpHtml = fs.readFileSync(glpPath, 'utf8');
  const bacHtml = fs.readFileSync(bacPath, 'utf8');

  // Tracking
  assert.ok(glpHtml.includes('GTM-M2GVDQ44'), 'GLP-1 includes GTM');
  assert.ok(bacHtml.includes('GTM-M2GVDQ44'), 'BAC Water includes GTM');
  assert.ok(glpHtml.includes('captureGoogleAdClick'), 'GLP-1 includes gclid capture');
  assert.ok(bacHtml.includes('captureGoogleAdClick'), 'BAC Water includes gclid capture');

  // Checkout connection
  assert.ok(glpHtml.includes('/api/orders/create'), 'GLP-1 connects to /api/orders/create');
  assert.ok(bacHtml.includes('/api/orders/create'), 'BAC Water connects to /api/orders/create');
  assert.ok(glpHtml.includes('/pay-card?order='), 'GLP-1 redirects to /pay-card');
  assert.ok(bacHtml.includes('/pay-card?order='), 'BAC Water redirects to /pay-card');
  assert.ok(glpHtml.includes('research_ack'), 'GLP-1 sends the required research acknowledgement');
  assert.ok(bacHtml.includes('research_ack'), 'BAC Water sends the required research acknowledgement');
  assert.ok(glpHtml.includes('checkout_submit') && glpHtml.includes('user_data'), 'GLP-1 sends enhanced checkout tracking');
  assert.ok(bacHtml.includes('checkout_submit') && bacHtml.includes('user_data'), 'BAC Water sends enhanced checkout tracking');

  // Live product sync
  assert.ok(glpHtml.includes('/api/lp/products'), 'GLP-1 syncs products from /api/lp/products');
  assert.ok(bacHtml.includes('/api/lp/products'), 'BAC Water syncs products from /api/lp/products');

  // File size optimization: under 800 KB (down from 3.95 MB)
  assert.ok(glpHtml.length < 800000, `GLP-1 HTML is optimized (${glpHtml.length} bytes)`);
  assert.ok(bacHtml.length < 800000, `BAC Water HTML is optimized (${bacHtml.length} bytes)`);
  assert.equal(glpHtml.includes('data:image/webp;base64'), false, 'GLP-1 has no embedded WebP images');
  assert.equal(bacHtml.includes('data:image/webp;base64'), false, 'BAC Water has no embedded WebP images');

  // Assets exist
  assert.ok(fs.existsSync(path.join(rootDir, 'public/lp-assets/heroes/metabolic-hero.jpg')), 'Hero image exists');
  assert.ok(fs.existsSync(path.join(rootDir, 'public/lp-assets/icons/logo-new.webp')), 'Logo icon exists');
});

test('next.config.mjs keeps /lp on the lead page and adds /lp/glp-1 and /lp/bac-water', () => {
  const config = fs.readFileSync(path.join(rootDir, 'next.config.mjs'), 'utf8');
  assert.match(config, /source: '\/lp',\s*destination: '\/lp\/index\.html'/, '/lp stays the lead-form page');
  assert.match(config, /source: '\/lp-testing\/glp-1',\s*destination: '\/lp\/glp-1\/index\.html'/, 'QA preview of glp-1');
  assert.match(config, /source: '\/lp-testing\/bac-water',\s*destination: '\/lp\/bac-water\/index\.html'/, 'QA preview of bac-water');
  assert.match(config, /source: '\/lp-testing\/:path\*',\s*headers: \[\{ key: 'X-Robots-Tag', value: 'noindex, nofollow' \}\]/, 'preview is not indexed');
});

test('live landing-page catalog endpoint hides administratively hidden products', () => {
  const route = fs.readFileSync(path.join(rootDir, 'src/app/api/lp/products/route.js'), 'utf8');
  assert.ok(route.includes("eq('id', 'hidden_products')"));
  assert.ok(route.includes('if (hiddenResult.error) throw hiddenResult.error'));
  assert.ok(route.includes('!hiddenNames.has(product.product)'));
});

test('WhatsApp orders are saved before the thank-you page, on the current number', () => {
  for (const page of ['public/lp/glp-1/index.html', 'public/lp/bac-water/index.html']) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const body = html.slice(html.indexOf('function placeOrder(method)'), html.indexOf('/* ---------------- thank-you page'));
    assert.equal((body.match(/fetch\('\/api\/orders\/create'/g) || []).length, 1, `${page}: one order request for both methods`);
    assert.match(body, /payment_method: isCard \? 'card' : 'whatsapp'/, page);
    const saved = body.indexOf('if (isCard) {');
    assert.ok(saved > 0 && body.indexOf('event: "whatsapp_order"') > saved, `${page}: whatsapp_order fires only after the order is saved`);
    assert.ok(body.indexOf('go("thank-you")') > saved, `${page}: thank-you page only after the save`);
    assert.doesNotMatch(html, /8404|50684046973/, `${page}: retired WhatsApp number`);
    assert.match(html, /wa: "50660604775"/, page);
    // The orders table has no `notes` or `lang` column: sending either failed every insert.
    assert.doesNotMatch(body, /^\s*(notes|lang):/m, `${page}: no fields the orders table lacks`);
    assert.match(body, /internal_notes: \[window\.LP_TESTING \? 'TEST: /, `${page}: preview orders are marked TEST`);
    assert.match(body, /ad_attribution: window\.LP_TESTING \? null : googleClick/, page);
  }
});

test('live colón prices are read from the display text the API sends, and a price change re-posts once', () => {
  for (const page of ['public/lp/glp-1/index.html', 'public/lp/bac-water/index.html']) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const fn = html.match(/function catalogColones\(value\) \{[\s\S]*?\n\}/);
    assert.ok(fn, `${page}: catalogColones`);
    const catalogColones = new Function(`${fn[0]}; return catalogColones;`)();
    assert.equal(catalogColones('₡45,027'), 45027);
    assert.equal(catalogColones(45027), 45027);
    assert.ok(Number.isNaN(catalogColones('')));
    assert.match(html, /!Number\.isFinite\(catalogColones\(row\.priceCrc\)\)\) return;/);
    assert.match(html, /p: Math\.round\(catalogColones\(row\.priceCrc\)\)/);
    assert.match(html, /data\.errorCode === 'price_changed' && p && Number\.isFinite\(Number\(p\.totalCrc\)\) && Number\(p\.totalCrc\) <= orderPayload\.total_crc/, `${page}: never re-posts at a higher total`);
  }
});

test('the /lp-testing preview loads no Tag Manager and keeps no ad click', () => {
  for (const page of ['public/lp/glp-1/index.html', 'public/lp/bac-water/index.html']) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const flag = html.match(/<script>(window\.LP_TESTING = [^<]+)<\/script>/);
    assert.ok(flag && html.indexOf(flag[0]) < html.indexOf('GTM-M2GVDQ44'), `${page}: flag set before GTM`);
    const isTesting = (pathname) => new Function('location', 'window', flag[1] + '; return window.LP_TESTING;')({ pathname }, {});
    assert.equal(isTesting('/lp-testing'), true);
    assert.equal(isTesting('/lp-testing/glp-1'), true);
    assert.equal(isTesting('/lp/glp-1'), false);
    assert.equal(isTesting('/lp-testingx'), false);
    assert.match(html, /<script>if \(!window\.LP_TESTING\) \(function\(w,d,s,l,i\)\{/, `${page}: GTM skipped on the preview`);
    assert.match(html, /function captureGoogleAdClick\(\)\{\n  if \(window\.LP_TESTING\) return;/, `${page}: no click saved on the preview`);
  }
});

test('a product with no stock count (null) is not shown as out of stock', () => {
  for (const page of ['public/lp/glp-1/index.html', 'public/lp/bac-water/index.html']) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const rule = html.match(/oos: (\(row\.inventoryCount !== null[\s\S]*?<= 0\)) \|\|/);
    assert.ok(rule, `${page}: stock rule`);
    const soldOut = (inventoryCount) => new Function('row', `return ${rule[1]};`)({ inventoryCount });
    assert.equal(soldOut(null), false, 'BAC Water has no count and is in stock');
    assert.equal(soldOut(undefined), false);
    assert.equal(soldOut(0), true);
    assert.equal(soldOut(5), false);
  }
});
