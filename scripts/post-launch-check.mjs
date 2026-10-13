/**
 * Production smoke test for the WordPress -> Next.js cutover.
 *
 * Run immediately after DNS changes and again during the monitoring window:
 *   node scripts/post-launch-check.mjs
 *   node scripts/post-launch-check.mjs https://peptidescostarica.net
 */
import * as cheerio from 'cheerio';

const BASE = new URL(process.argv[2] || 'https://peptidescostarica.net');
const failures = [];

const urlFor = (path) => new URL(path, BASE).toString();
const fail = (path, message) => failures.push(`${path}: ${message}`);

async function request(path, options = {}) {
  try {
    return await fetch(urlFor(path), {
      redirect: options.redirect || 'follow',
      headers: { 'user-agent': 'Peptides-Costa-Rica-Launch-Check/1.0' },
    });
  } catch (error) {
    fail(path, `request failed (${error.message})`);
    return null;
  }
}

const sitemapPaths = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-xag.xml',
  '/sitemap-xagio-post.xml',
  '/sitemap-xagio-page.xml',
  '/sitemap-xagio-product.xml',
  '/sitemap-xagio-product_cat.xml',
];

const pagePaths = [
  '/',
  '/es/',
  '/shop/',
  '/es/shop/',
  '/product/5-amino-1mq-50mg/',
  '/es/producto/5-amino-1mq-50mg/',
  '/product-category/bac-water/',
  '/es/categoria-de-producto/agua-de-bac/',
  '/blog/are-peptides-illegal-in-costa-rica/',
];

const redirects = [
  ['/es/tienda', '/es/shop/'],
  ['/es/producto-2/5-amino-1mq-50mg', '/es/producto/5-amino-1mq-50mg/'],
  ['/es/categoria-producto-2/agua-de-bac', '/es/categoria-de-producto/agua-de-bac/'],
  ['/tirzepatida-costa-rica', '/tirzepatide-costa-rica/'],
];

const robots = await request('/robots.txt');
if (robots) {
  const text = await robots.text();
  if (!robots.ok) fail('/robots.txt', `HTTP ${robots.status}`);
  if (/^\s*Disallow:\s*\/\s*$/im.test(text)) fail('/robots.txt', 'sitewide crawl block is still active');
  if (!text.includes('/sitemap.xml')) fail('/robots.txt', 'canonical sitemap is not advertised');
}

let canonicalSitemapCount = 0;
for (const path of sitemapPaths) {
  const response = await request(path);
  if (!response) continue;
  const xml = await response.text();
  if (!response.ok) fail(path, `HTTP ${response.status}`);
  if (!/<urlset[\s>]/i.test(xml)) fail(path, 'does not return a URL sitemap');
  if (path === '/sitemap.xml') {
    canonicalSitemapCount = (xml.match(/<url>/g) || []).length;
    if (canonicalSitemapCount < 900) fail(path, `only ${canonicalSitemapCount} URLs found`);
    if (xml.includes('/producto-2/') || xml.includes('/categoria-producto-2/')) {
      fail(path, 'contains a retired Spanish URL base');
    }
  }
}

for (const path of pagePaths) {
  const response = await request(path);
  if (!response) continue;
  const html = await response.text();
  if (!response.ok) {
    fail(path, `HTTP ${response.status}`);
    continue;
  }
  const $ = cheerio.load(html);
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  if (/noindex/i.test(robotsMeta)) fail(path, 'noindex is still present');
  const canonical = $('link[rel="canonical"]').attr('href');
  if (!canonical) fail(path, 'canonical is missing');
  else if (new URL(canonical, BASE).hostname !== BASE.hostname) fail(path, `canonical points to ${canonical}`);
  if (!$('link[rel="alternate"][hreflang="en-US"]').length) fail(path, 'English hreflang is missing');
  if (!$('link[rel="alternate"][hreflang="es-CR"]').length) fail(path, 'Spanish hreflang is missing');
  if (!$('script[type="application/ld+json"]').length) fail(path, 'JSON-LD is missing');
}

for (const [source, destination] of redirects) {
  const response = await request(source, { redirect: 'manual' });
  if (!response) continue;
  if (![301, 308].includes(response.status)) fail(source, `expected a permanent redirect, got HTTP ${response.status}`);
  const location = response.headers.get('location');
  if (!location || new URL(location, BASE).pathname !== destination) {
    fail(source, `expected ${destination}, got ${location || 'no Location header'}`);
  }
}

console.log(`Base             : ${BASE.origin}`);
console.log(`Pages checked    : ${pagePaths.length}`);
console.log(`Sitemap aliases  : ${sitemapPaths.length}`);
console.log(`Sitemap URLs     : ${canonicalSitemapCount}`);
console.log(`Redirects checked: ${redirects.length}`);
console.log(`Issues           : ${failures.length}`);

if (failures.length) {
  console.error('\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('\nProduction is crawlable and the migration-critical SEO signals are healthy.');
