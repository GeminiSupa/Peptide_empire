import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productNameResolver } from '../src/lib/authoritativeCheckout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Every Google Ads shop page. They are one page template: the shop, cart,
// checkout and tracking below are identical in all of them, so each check runs
// over the whole list.
const AD_PAGES = [
  'public/lp/metabolic-research-compound/index.html',
  'public/lp/bac-water/index.html',
  'public/lp/glutathione-1500mg/index.html',
  'public/lp/nad-plus/index.html',
  'public/lp/ghk-cu-100mg/index.html',
  'public/lp/ipamorelin-10mg/index.html',
  'public/lp/tesa-compound/index.html',
  'public/lp/klow-80mg/index.html',
  'public/lp/glow-70mg/index.html',
];

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
  for (const page of AD_PAGES) {
    const file = path.join(rootDir, page);
    assert.ok(fs.existsSync(file), `${page} exists`);
    const html = fs.readFileSync(file, 'utf8');

    // Tracking
    assert.ok(html.includes('GTM-M2GVDQ44'), `${page} includes GTM`);
    assert.ok(html.includes('captureGoogleAdClick'), `${page} includes gclid capture`);

    // Checkout connection
    assert.ok(html.includes('/api/orders/create'), `${page} connects to /api/orders/create`);
    assert.ok(html.includes('/pay-card?order='), `${page} redirects to /pay-card`);
    assert.ok(html.includes('research_ack'), `${page} sends the required research acknowledgement`);
    assert.ok(html.includes('checkout_submit') && html.includes('user_data'), `${page} sends enhanced checkout tracking`);

    // Live product sync
    assert.ok(html.includes('/api/lp/products'), `${page} syncs products from /api/lp/products`);

    // File size optimization: under 800 KB (down from 3.95 MB)
    assert.ok(html.length < 800000, `${page} is optimized (${html.length} bytes)`);
    assert.equal(html.includes('data:image/webp;base64'), false, `${page} has no embedded WebP images`);
    assert.equal(html.includes('data:image/png;base64'), false, `${page} has no embedded PNG images`);
  }

  // Assets exist
  assert.ok(fs.existsSync(path.join(rootDir, 'public/lp-assets/heroes/metabolic-hero.jpg')), 'Hero image exists');
  assert.ok(fs.existsSync(path.join(rootDir, 'public/lp-assets/icons/logo-new.webp')), 'Logo icon exists');
});

test('the single-product pages each show their own compound, from one shared template', () => {
  const pages = [
    ['public/lp/glutathione-1500mg/index.html', 'glutathione', 'Glutathione 1500 mg, Reduced Form | Peptides Costa Rica'],
    ['public/lp/nad-plus/index.html', 'nadplus', 'NAD+ 500 mg and 1000 mg | Peptides Costa Rica'],
    ['public/lp/ghk-cu-100mg/index.html', 'ghk-cu', 'GHK-Cu 100 mg | Peptides Costa Rica'],
    ['public/lp/ipamorelin-10mg/index.html', 'ipamorelin', 'Ipamorelin 10 mg | Peptides Costa Rica'],
    ['public/lp/tesa-compound/index.html', 'tesamorelin', 'TESA-Compound 10 mg and 20 mg | Peptides Costa Rica'],
    ['public/lp/klow-80mg/index.html', 'klow', 'KLOW 80 mg | Peptides Costa Rica'],
    ['public/lp/glow-70mg/index.html', 'glow', 'GLOW 70 mg | Peptides Costa Rica'],
  ];
  const bodies = [];
  for (const [page, prod, title] of pages) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    assert.ok(html.includes(`<title>${title}</title>`), `${page}: its own title`);
    assert.ok(html.includes(`window.LP_MODE="prod";window.LP_PROD="${prod}"`), `${page}: shows ${prod}`);
    // The product it is built around must exist in the page's own catalog data.
    assert.match(html, new RegExp(`"slug": "${prod}"`), `${page}: ${prod} is in the product list`);
    // The compounds it offers alongside, which must exist too.
    const pairs = html.match(new RegExp(`"?${prod}"?: \\{[\\s\\S]*?pairs: \\[([^\\]]+)\\]`))?.[1];
    assert.ok(pairs, `${page}: pairing list`);
    for (const slug of pairs.match(/"([a-z0-9-]+)"/g).map((s) => s.slice(1, -1))) {
      assert.match(html, new RegExp(`"slug": "${slug}"`), `${page}: pairs with ${slug}, which must be a product`);
    }
    bodies.push(html.replace(`<title>${title}</title>`, '').replace(`window.LP_PROD="${prod}"`, ''));
  }
  const meta = /<meta name="description"[^>]*>/;
  const stripped = bodies.map((body) => body.replace(meta, ''));
  for (const body of stripped) assert.equal(body, stripped[0], 'the single-product pages stay one template');
});

// The metabolic and bac-water pages still carry the old payment wording and the
// old NAD+ default; changing them is its own job, so these two checks cover the
// pages built after that was decided.
const NEW_AD_PAGES = ['public/lp/glutathione-1500mg/index.html', 'public/lp/nad-plus/index.html',
  'public/lp/ghk-cu-100mg/index.html', 'public/lp/ipamorelin-10mg/index.html',
  'public/lp/tesa-compound/index.html', 'public/lp/klow-80mg/index.html', 'public/lp/glow-70mg/index.html'];

test('the single-product pages do not promise cash on delivery', () => {
  // We don't take it (owner, 10 Nov 2026); checkout takes card, SINPE Móvil and
  // bank transfer. Same wording as the website's product page.
  for (const page of NEW_AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    assert.doesNotMatch(html, /cash on delivery|contra entrega|cash when it arrives|efectivo al recibir/i, page);
    assert.ok(html.includes('Money-back guarantee'), `${page}: the badge that replaced it`);
    assert.ok(html.includes('"Money-back guarantee":"Garantía de reembolso"'), `${page}: in Spanish too`);
  }
});

test('every ad page reports one page view per page, not one per re-render', () => {
  // The router runs again when the live catalog arrives and when language or
  // currency changes. Each run used to push its own page_view_virtual, so
  // Analytics counted two or three views for one visit (12 Nov 2026). The
  // metabolic and bac-water pages were still counting three on 13 Nov; it
  // reached nobody only because their advertised address loaded no Tag
  // Manager. Publishing them on /lp would have started inflating the figures.
  for (const page of AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const pushes = html.match(/dataLayer\.push\(\{ event: "page_view_virtual"/g) || [];
    assert.equal(pushes.length, 1, `${page}: one place reports a page view`);
    assert.match(html, /if \(path === _pvPath && now - _pvAt < 2000\) return;/, `${page}: a repeat of the same path is dropped`);
    assert.equal((html.match(/pageView\(k\);/g) || []).length, 2, `${page}: both routers go through it`);
  }
});

test('the NAD+ page opens on its 1000 mg vial, the size the page recommends', () => {
  // Marketing, 6 Nov 2026: "default size 1000 mg, not 500". The shared product
  // list takes its default sizes from the live catalog feed, so this one is the
  // page's own: it is used when that size is in stock, and ignored otherwise.
  for (const page of NEW_AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    assert.match(html, /key: "nad-plus", size: "1000 mg"/, `${page}: the size the NAD\\+ page leads with`);
    assert.match(
      html,
      /return \(PC\.size && PROD\.v\.some\(function \(x\) \{ return x\.s === PC\.size && !x\.oos; \}\)\) \? PC\.size : PROD\.def;/,
      `${page}: falls back to the catalog's default when that size is sold out`,
    );
    // The photo, the chooser and the price all follow that one size.
    assert.match(html, /Q\.size = prodSize\(\);/, `${page}: the chooser opens on it`);
    assert.match(html, /pimg\(PROD, prodSize\(\)\)/, `${page}: the hero shows that vial`);
  }
});

test('next.config.mjs keeps /lp on the lead page and adds /lp/metabolic-research-compound and /lp/bac-water', () => {
  const config = fs.readFileSync(path.join(rootDir, 'next.config.mjs'), 'utf8');
  assert.match(config, /source: '\/lp',\s*destination: '\/lp\/index\.html'/, '/lp stays the lead-form page');
  assert.match(config, /source: '\/lp\/glp-1',\s*destination: '\/lp\/metabolic-research-compound',\s*permanent: false/, 'old GLP address follows the page');
  assert.equal(fs.existsSync(path.join(rootDir, 'public/lp/glp-1')), false, 'no page left at a GLP address');
  // No ad page is served on /lp-testing any more (13 Nov 2026). That address
  // loads no Tag Manager, so an ad pointed at it recorded nothing; the shared
  // preview links redirect to the tracked page instead of serving an untracked
  // copy of it. The bare /lp-testing and the old GLP link go straight to the
  // real metabolic page, with no second hop.
  assert.doesNotMatch(config, /source: '\/lp-testing[^']*',\s*destination: '[^']*\.html'/, 'nothing is served on a preview address');
  for (const [preview, real] of [['/lp-testing', '/lp/metabolic-research-compound'], ['/lp-testing/glp-1', '/lp/metabolic-research-compound'], ['/lp-testing/metabolic-research-compound', '/lp/metabolic-research-compound'], ['/lp-testing/bac-water', '/lp/bac-water']]) {
    assert.match(config, new RegExp(`source: '${preview}',\\s*destination: '${real}',\\s*permanent: false`), `${preview} lands on ${real}`);
  }
  // The single-product pages were approved on 12 Nov 2026: they have no
  // preview address any more, and the QA links already shared redirect to the
  // real page rather than 404.
  for (const slug of ['glutathione-1500mg', 'nad-plus']) {
    assert.match(config, new RegExp(`source: '/lp/${slug}',\\s*destination: '/lp/${slug}/index\\.html'`), `real address of ${slug}`);
    assert.doesNotMatch(config, new RegExp(`source: '/lp-testing/${slug}',\\s*destination: '/lp/${slug}/index\\.html'`), `no preview left for ${slug}`);
    assert.match(config, new RegExp(`source: '/lp-testing/${slug}',\\s*destination: '/lp/${slug}',\\s*permanent: false`), `old QA link of ${slug} follows the page`);
  }
  assert.match(config, /source: '\/lp-testing\/:path\*',\s*headers: \[\{ key: 'X-Robots-Tag', value: 'noindex, nofollow' \}\]/, 'preview is not indexed');
  // The main site has its own pages for these compounds; the ad pages must not
  // compete with them in Google (12 Nov 2026; the other two added 13 Nov, when
  // their noindex preview address went away).
  for (const slug of ['glutathione-1500mg', 'nad-plus', 'metabolic-research-compound', 'bac-water', 'ghk-cu-100mg', 'ipamorelin-10mg', 'tesa-compound', 'klow-80mg', 'glow-70mg']) {
    assert.match(config, new RegExp(`source: '/lp/${slug}',\\s*headers: \\[\\{ key: 'X-Robots-Tag', value: 'noindex, follow' \\}\\]`), `${slug} stays out of Google`);
  }
  // The two pages the ads team asked for (15 Nov 2026) answer on their own
  // address, the one their ads will point at.
  for (const slug of ['ghk-cu-100mg', 'ipamorelin-10mg', 'tesa-compound', 'klow-80mg', 'glow-70mg']) {
    assert.match(config, new RegExp(`source: '/lp/${slug}',\\s*destination: '/lp/${slug}/index\\.html'`), `real address of ${slug}`);
  }
});

test('live landing-page catalog endpoint hides administratively hidden products', () => {
  const route = fs.readFileSync(path.join(rootDir, 'src/app/api/lp/products/route.js'), 'utf8');
  assert.ok(route.includes("eq('id', 'hidden_products')"));
  assert.ok(route.includes('if (hiddenResult.error) throw hiddenResult.error'));
  assert.ok(route.includes('!hiddenNames.has(product.product)'));
});

test('WhatsApp orders are saved before the thank-you page, on the current number', () => {
  for (const page of AD_PAGES) {
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
  for (const page of AD_PAGES) {
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
  for (const page of AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const flag = html.match(/<script>(window\.LP_TESTING = [^<]+)<\/script>/);
    assert.ok(flag && html.indexOf(flag[0]) < html.indexOf('GTM-M2GVDQ44'), `${page}: flag set before GTM`);
    const isTesting = (pathname) => new Function('location', 'window', flag[1] + '; return window.LP_TESTING;')({ pathname }, {});
    assert.equal(isTesting('/lp-testing'), true);
    assert.equal(isTesting('/lp-testing/glp-1'), true);
    assert.equal(isTesting('/lp/glp-1'), false);
    assert.equal(isTesting('/lp-testingx'), false);
    assert.match(html, /<script>if \(!window\.LP_TESTING\) \(function\(w,d,s,l,i\)\{/, `${page}: GTM skipped on the preview`);
    // The pages are saved with Windows line endings, so match either.
    assert.match(html, /function captureGoogleAdClick\(\)\{\r?\n  if \(window\.LP_TESTING\) return;/, `${page}: no click saved on the preview`);
  }
});

test('a product with no stock count (null) is not shown as out of stock', () => {
  for (const page of AD_PAGES) {
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

test('Shopper Approved shows in the artifact design, filled from the live widget data', () => {
  for (const page of AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    assert.match(html, /function saLive\(\)/, `${page}: reads the live widget data`);
    assert.ok(html.includes('based on (\\d+) reviews/'), `${page}: live review count, not a hardcoded one`);
    assert.match(html, /\.sawrap\.lpsa>\.SA__wrapper\{position:absolute!important;left:-10000px/, `${page}: live widget kept off screen`);
    assert.match(html, /\$\$\("#page \.shopperlink"\)\.forEach\(function \(a\) \{ a\.innerHTML = '<span class="lpfall">/, `${page}: hero shows the artifact pill`);
    assert.doesNotMatch(html, /32 verified reviews/, `${page}: no stale count`);
  }
});

test('the metabolic products show Ted\'s codes, and orders still carry the real catalog names', () => {
  // The live catalog names Retatrutide "GLP-1 (RT) – Agonista Triple" (10 Nov 2026).
  const resolver = productNameResolver([
    { product: 'GLP-1 (RT) – Agonista Triple 20mg', price_usd: 220 },
    { product: 'GLP-1 (RT) Pen 40mg', price_usd: 600 },
    { product: 'Retatrutide 20mg', price_usd: 220 },
    { product: 'Tirzepatide 10mg', price_usd: 140 },
    { product: 'Semaglutide 10mg', price_usd: 180 },
    { product: '5-Amino-1MQ 50mg', price_usd: 90 },
  ]);
  for (const page of AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8').replace(/\r\n/g, '\n');
    assert.doesNotMatch(html, /"GLP-1 \((RT|TRZ|SEM)\)"|"5-Amino-1MQ"/, `${page}: old display names gone from the page data`);
    for (const code of ['GLP3RT', 'GLP2TZ', 'GLP1SM', '5A1MQ']) assert.ok(html.includes(`"${code}"`), `${page}: shows ${code}`);
    const block = html.match(/var GLP_CODES = [\s\S]*?\nfunction catalogProductName\(name\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(block, `${page}: name functions present`);
    const names = () => new Function(`${block}; return { landingProductName, catalogProductName, CATALOG_BASE };`)();
    const { landingProductName, catalogProductName, CATALOG_BASE } = names();
    // Live catalog names, old or new, show as the codes...
    assert.equal(landingProductName('GLP-1 (RT) – Agonista Triple'), 'GLP3RT');
    assert.equal(landingProductName('GLP-1 (RT) Pen'), 'GLP3RT Pen');
    assert.equal(landingProductName('Retatrutide'), 'GLP3RT');
    assert.equal(landingProductName('Tirzepatide'), 'GLP2TZ');
    assert.equal(landingProductName('Semaglutide'), 'GLP1SM');
    assert.equal(landingProductName('5-Amino-1MQ'), '5A1MQ');
    assert.equal(landingProductName('BPC-157'), 'BPC-157');
    // ...orders send the exact live name the code was built from...
    CATALOG_BASE.GLP3RT = 'GLP-1 (RT) – Agonista Triple';
    CATALOG_BASE['GLP3RT Pen'] = 'GLP-1 (RT) Pen';
    assert.equal(resolver(catalogProductName('GLP3RT') + ' 20 mg')?.product, 'GLP-1 (RT) – Agonista Triple 20mg', page);
    assert.equal(resolver(catalogProductName('GLP3RT Pen') + ' 40 mg')?.product, 'GLP-1 (RT) Pen 40mg', page);
    // ...and without the live catalog, exactly what the page sent before the rename.
    const offline = names().catalogProductName;
    assert.equal(resolver(offline('GLP3RT') + ' 20 mg')?.product, 'Retatrutide 20mg', page);
    assert.equal(resolver(offline('GLP2TZ') + ' 10 mg')?.product, 'Tirzepatide 10mg', page);
    assert.equal(resolver(offline('GLP1SM') + ' 10 mg')?.product, 'Semaglutide 10mg', page);
    assert.equal(resolver(offline('5A1MQ') + ' 50 mg')?.product, '5-Amino-1MQ 50mg', page);
    assert.match(html, /CATALOG_BASE\[displayName\] = parts\.base;/, `${page}: live names recorded`);
    assert.match(html, /return \{ product: catalogProductName\(it\.name\) \+ ' ' \+ it\.s, qty: it\.qty \};/, `${page}: orders send the real name`);
  }
});

test('Tesamorelin shows as TESA-Compound with its own photo, and orders still send Tesamorelin', () => {
  // Designer's ad pages, 17 Nov 2026. The bottle photo is a new file, never an
  // overwrite: /lp-assets is cached for a year.
  const resolver = productNameResolver([
    { product: 'Tesamorelin 10mg', price_usd: 100 },
    { product: 'Tesamorelin 20mg', price_usd: 150 },
  ]);
  for (const page of NEW_AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8').replace(/\r\n/g, '\n');
    assert.doesNotMatch(html, /"Tesamorelin"/, `${page}: old display name gone from the page data`);
    assert.match(html, /"name": "TESA-Compound", "cat": "gh", "slug": "tesamorelin"/, page);
    assert.ok(html.includes('"TESA-Compound":"tesa-compound-10mg"'), `${page}: photo key`);
    assert.ok(html.includes('"tesa-compound-10mg":"/lp-assets/products/tesa-compound-10mg.webp"'), `${page}: photo file`);
    const block = html.match(/var GLP_CODES = [\s\S]*?\nfunction catalogProductName\(name\) \{[\s\S]*?\n\}/)?.[0];
    const { landingProductName, catalogProductName } = new Function(`${block}; return { landingProductName, catalogProductName };`)();
    assert.equal(landingProductName('Tesamorelin'), 'TESA-Compound');
    assert.equal(resolver(catalogProductName('TESA-Compound') + ' 10 mg')?.product, 'Tesamorelin 10mg', page);
  }
  assert.ok(fs.existsSync(path.join(rootDir, 'public/lp-assets/products/tesa-compound-10mg.webp')));
});

test('each designer page carries its own tactic under the hero, priced from the live list and the tiers', () => {
  const html = fs.readFileSync(path.join(rootDir, 'public/lp/klow-80mg/index.html'), 'utf8').replace(/\r\n/g, '\n');
  for (const [prod, tactic] of [['tesamorelin', 'tacticCoaFirst'], ['ipamorelin', 'tacticFifthVial'], ['klow', 'tacticUnbundle'], ['glow', 'tacticOneTap']]) {
    const block = html.match(new RegExp(`\\n    ${prod}: \\{[\\s\\S]*?\\n    \\}`))?.[0] || '';
    assert.ok(block.includes(`extra: function () { return ${tactic}(); }`), `${prod} uses ${tactic}`);
  }
  assert.ok(html.includes('"</div></div></section>" + (PC.extra ? PC.extra() : "") +'), 'shown under the hero');
  const fifth = html.slice(html.indexOf('function tacticFifthVial'), html.indexOf('function tacticUnbundle'));
  assert.ok(fifth.includes('disc(5)') && fifth.includes('disc(10)'), 'discounts come from CFG.tiers, not hard-coded');
  assert.ok(html.includes('dataLayer.push({ event: "whatsapp_click", ref: ref(), cta: a.dataset.txwa });'), 'tactic WhatsApp taps are counted');
});

test('every ad page carries the TikTok pixel, the paid click ids, the visit source and tracked WhatsApp taps', async () => {
  // These are static files, so the app's layout (TikTok pixel) and
  // EcommerceTracker (pcr_touch) never ran on them, and the order carried no
  // ref / cid / ttclid — the order-paid webhook only reports orders that do.
  const { getTikTokPixelBootstrapScript } = await import('../src/lib/tiktokPixel.mjs');
  for (const page of AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(html.includes(`<script>if (!window.LP_TESTING) ${getTikTokPixelBootstrapScript()}</script>`), `${page}: the app's TikTok pixel`);
    for (const [param, key] of [['ref', 'landing_ref'], ['cid', 'landing_cid'], ['ttclid', 'landing_ttclid']]) {
      assert.ok(html.includes(`["${param}", "${key}",`), `${page}: keeps ?${param}=`);
      assert.ok(html.includes(`    ${key}: window.LP_TESTING ? null : window.lpLanding("${key}")`), `${page}: sends ${key} with the order`);
    }
    assert.ok(html.includes('fetch("/api/lp/touch", { method: "POST"'), `${page}: records the visit's source`);
    // On the main site the order goes to the catalog's address with no cookie, so the source rides in the order.
    assert.ok(html.includes('    touch: window.LP_TESTING ? null : (window.lpTouchState || null)'), `${page}: sends the visit source with the order`);
    assert.ok(html.includes('function wa(msg) { return "/api/whatsapp/open?phone=" + CFG.wa'), `${page}: WhatsApp taps go through the tracked redirect`);
    assert.doesNotMatch(html, /https:\/\/wa\.me\//, `${page}: no untracked WhatsApp link left`);
  }
  const route = fs.readFileSync(path.join(rootDir, 'src/app/api/lp/touch/route.js'), 'utf8');
  assert.ok(route.includes("import { captureTouch } from '@/lib/touchTracker.mjs';"), 'the app\'s own touch logic, not a copy');
  assert.ok(route.includes('if (page.host !== host)'), 'only for the page the request came from');
  assert.ok(route.includes('NextResponse.json({ touch: state || null }'), 'hands the source back to the page');
});

test('the ad pages read in Spanish: their own copy is in the dictionary', () => {
  for (const page of AD_PAGES) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8').replace(/\r\n/g, '\n');
    const block = html.slice(html.indexOf('/* Spanish for the ad pages'), html.indexOf('\nfunction tr(s) {'));
    assert.ok(block.startsWith('/* Spanish for the ad pages'), `${page}: Spanish block before tr()`);
    const ES = {}, ESR = [];
    new Function('ES', 'ESR', block)(ES, ESR);
    // Every product's own copy on the single-product pages has a translation.
    // A string the page already translated in its main dictionary counts too.
    const known = (text) => ES[text] || html.includes(`${JSON.stringify(text)}:`);
    const prods = html.match(/var PRODS = \{[\s\S]*?\n {2}\};/)?.[0];
    if (prods) {
      for (const [, text] of prods.matchAll(/(?:sub|plain|plainH): "([^"]+)"/g)) assert.ok(known(text), `${page}: "${text.slice(0, 50)}…" in Spanish`);
      for (const [, q, a] of prods.matchAll(/\["([^"]+\?)", "([^"]+)"\]/g)) {
        assert.ok(known(q), `${page}: FAQ "${q}" in Spanish`);
        assert.ok(known(a), `${page}: answer to "${q}" in Spanish`);
      }
    }
    const tr = (s) => ES[s] ?? ESR.reduce((out, [re, to]) => (out === null && re.test(s) ? s.replace(re, to) : out), null) ?? s;
    assert.equal(tr('Order KLOW for your research'), 'Pida KLOW para su investigación');
    assert.equal(tr('15% unlocked. Add 5 more for 20% off.'), '15% desbloqueado. Agregue 5 más para 20% de descuento.');
  }
});
