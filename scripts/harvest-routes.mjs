/**
 * Harvest the complete live URL inventory from peptidescostarica.net.
 *
 * Writes data/routes.json — every English URL, its Spanish twin, and a group.
 * Re-run this before the launch audit; the live site keeps growing.
 *
 * Sources, and why both are needed:
 *   1. The four Xagio XML sitemaps  → the authoritative English URL set.
 *   2. /html-sitemap/ + /es/mapa-del-sitio-html/ → the EN↔ES pairing.
 *
 * The Spanish pairing cannot be derived. TranslatePress is running with
 * translated slugs, so /about/ is served at /es/acerca-de/, not /es/about/.
 * Some pages keep the English slug, some don't, and there is no rule — it is
 * per-page data that has to be harvested. The two HTML sitemaps are rendered
 * from the same widget in the same order, so link N in one is the twin of
 * link N in the other. VERIFIED_PAIRS below re-checks that assumption on every
 * run against pairs confirmed independently by following /es/<slug> redirects;
 * if the widget order ever changes, this script fails instead of writing a
 * silently wrong map.
 *
 * Usage: node scripts/harvest-routes.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/routes.json');

/** Confirmed by following /es/<english-slug> redirects one page at a time. */
const VERIFIED_PAIRS = {
  '/': '/es/',
  '/about/': '/es/acerca-de/',
  '/blog/': '/es/blog/',
  '/our-story/': '/es/nuestra-historia/',
  '/cartago/': '/es/cartago/',
  '/limon/': '/es/limon/',
  '/shop/': '/es/tienda/',
  '/jaco-puntarenas/': '/es/jaco-puntarenas/',
  '/bpc-157-costa-rica/': '/es/bpc-157-costa-rica/',
  '/kpv-complete-guide/': '/es/guia-completa-de-kpv/',
  '/peptides-for-weight-loss/': '/es/peptidos-para-la-perdida-de-peso/',
  '/product/bpc-157-10mg/': '/es/producto-2/bpc-157-10mg/',
  '/product-category/peptides-for-skin/': '/es/categoria-producto-2/peptidos-para-la-piel/',
  '/blog/peptides-guide/': '/es/blog/guia-de-peptidos/',
  '/all-peptide-products-costa-rica/': '/es/todos-los-productos-de-peptidos-costa-rica/',
  '/html-sitemap/': '/es/mapa-del-sitio-html/',
};

/** The 14 marketing category pages, as linked from the live SHOP BY CATEGORY menu. */
const CATEGORY_PAGES = [
  '/peptides-for-weight-loss/',
  '/peptides-for-muscle-growth/',
  '/peptides-for-anti-aging/',
  '/peptides-for-healing/',
  '/peptides-for-energy/',
  '/peptides-for-fertility/',
  '/peptides-for-skin/',
  '/peptides-for-sleep/',
  '/copper-peptides/',
  '/collagen-peptides-costa-rica/',
  '/peptides-for-bac-water/',
  '/hgh-human-growth-hormone/',
  // Singular "peptide" in these two. Matches the live site; easy to typo into a 404.
  '/peptide-for-cognitive-function/',
  '/peptide-for-cardiovascular-costa-rica/',
];

const CORE_PAGES = [
  '/',
  '/about/',
  '/our-story/',
  '/bulk-discounts/',
  '/lab-tests-coa-results/',
  '/affiliate-program/',
  '/faq-costa-rica/',
  '/contact-costa-rica/',
  '/blog/',
  '/info-center/',
  '/peptide-guides/',
  '/customer-feedback/',
  '/our-service-locations/',
  '/all-peptide-products-costa-rica/',
  '/shop/',
];

const LEGAL_PAGES = [
  '/privacy-policy/',
  '/shipping-policy/',
  '/return-refund-policy/',
  '/html-sitemap/',
];

/**
 * Live but not worth rebuilding: WordPress leftovers, duplicate drafts and a
 * WooCommerce account page. Listed rather than dropped — each one is a decision
 * for the client (301 or let it 404), not something to silently lose.
 */
const EXCLUDE_CANDIDATES = [
  '/blog-2/',
  '/test-script/',
  '/basic-template-homepage/',
  '/return-refund-policy-2/',
  '/our-authors/',
  '/my-account/',
];

const PROVINCES = [
  'san-jose',
  'alajuela',
  'cartago',
  'heredia',
  'guanacaste',
  'puntarenas',
  'limon',
];

const isCityPage = (path) => {
  const slug = path.replace(/^\/|\/$/g, '');
  return PROVINCES.includes(slug) || PROVINCES.some((p) => slug.endsWith(`-${p}`));
};

async function get(path) {
  const res = await fetch(ORIGIN + path, { headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.text();
}

const toPath = (url) => url.replace(ORIGIN, '') || '/';

/** Pull <loc> values out of a sitemap without a full XML parser. */
function locs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => toPath(m[1].trim()));
}

/**
 * Same-origin <a> hrefs, in document order — the order is what carries the pairing.
 *
 * Anchors only. Matching every href would also pull in the <head> <link rel>
 * tags (canonical, hreflang, shortlink), and those differ between the English
 * and Spanish pages, which knocks the two lists out of alignment by one.
 */
function sitemapLinks(html) {
  return [...html.matchAll(/<a\s[^>]*?href="(https:\/\/peptidescostarica\.net[^"#?]*)"/g)].map((m) =>
    toPath(m[1])
  );
}

async function main() {
  console.log('Fetching XML sitemaps…');
  const [pageXml, productXml, productCatXml, postXml] = await Promise.all([
    get('/sitemap-xagio-page.xml'),
    get('/sitemap-xagio-product.xml'),
    get('/sitemap-xagio-product_cat.xml'),
    get('/sitemap-xagio-post.xml'),
  ]);

  const pages = locs(pageXml);
  const wooProducts = locs(productXml);
  const wooCategories = locs(productCatXml);
  const posts = locs(postXml);

  console.log('Fetching HTML sitemaps for the EN↔ES pairing…');
  const [enHtml, esHtml] = await Promise.all([
    get('/html-sitemap/'),
    get('/es/mapa-del-sitio-html/'),
  ]);

  const enLinks = sitemapLinks(enHtml);
  const esLinks = sitemapLinks(esHtml);

  if (enLinks.length !== esLinks.length) {
    throw new Error(
      `HTML sitemaps no longer align: ${enLinks.length} EN links vs ${esLinks.length} ES links. ` +
        `The positional pairing is invalid — fix this script before trusting its output.`
    );
  }

  // Index 0/1 are the language switcher (each page links itself, then the other
  // language), so the aligned content starts at 2.
  const pairs = {};
  for (let i = 2; i < enLinks.length; i += 1) {
    const en = enLinks[i];
    const es = esLinks[i];
    if (!en.startsWith('/es/') && es.startsWith('/es/')) pairs[en] = es;
  }

  // Fail loudly rather than emit a silently mis-aligned map.
  const mismatches = Object.entries(VERIFIED_PAIRS)
    .filter(([en, es]) => pairs[en] !== es)
    .map(([en, es]) => `${en} → expected ${es}, harvested ${pairs[en] ?? '(missing)'}`);

  if (mismatches.length > 0) {
    throw new Error(
      `Positional pairing failed ${mismatches.length}/${Object.keys(VERIFIED_PAIRS).length} ` +
        `spot checks:\n  ${mismatches.join('\n  ')}`
    );
  }
  console.log(`Pairing verified against ${Object.keys(VERIFIED_PAIRS).length} independent spot checks.`);

  const known = new Set([
    ...CORE_PAGES,
    ...LEGAL_PAGES,
    ...CATEGORY_PAGES,
    ...EXCLUDE_CANDIDATES,
  ]);

  const productLanders = pages.filter(
    (p) => (p.endsWith('-costa-rica/') || p === '/bpc-157-tb-500-wolverine-stack/') && !known.has(p)
  );
  const cityPages = pages.filter(isCityPage);

  const claimed = new Set([...known, ...productLanders, ...cityPages]);
  const guides = pages.filter((p) => !claimed.has(p));

  const groups = {
    core: CORE_PAGES,
    legal: LEGAL_PAGES,
    category: CATEGORY_PAGES,
    productLander: productLanders,
    guide: guides,
    city: cityPages,
    blogPost: posts,
    wooProduct: wooProducts,
    wooCategory: wooCategories,
    excludeCandidate: EXCLUDE_CANDIDATES,
  };

  const routes = [];
  const missingEs = [];
  for (const [group, paths] of Object.entries(groups)) {
    for (const en of paths) {
      const es = pairs[en] ?? null;
      if (!es) missingEs.push(en);
      routes.push({ en, es, group });
    }
  }

  // Anything in a sitemap that no group claimed is a classification bug.
  const grouped = new Set(routes.map((r) => r.en));
  const unclassified = [...pages, ...wooProducts, ...wooCategories, ...posts].filter(
    (p) => !grouped.has(p)
  );
  if (unclassified.length > 0) {
    throw new Error(`Unclassified URLs (fix the grouping rules):\n  ${unclassified.join('\n  ')}`);
  }

  const counts = Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [k, v.length])
  );

  const payload = {
    harvestedAt: new Date().toISOString(),
    origin: ORIGIN,
    counts: {
      ...counts,
      totalEn: routes.length,
      totalEs: routes.filter((r) => r.es).length,
    },
    missingEs,
    routes,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${OUT}`);
  console.table(counts);
  console.log(`Total EN ${routes.length} · ES twins ${payload.counts.totalEs}`);
  if (missingEs.length) console.log(`No Spanish twin: ${missingEs.join(', ')}`);
}

main().catch((err) => {
  console.error(`\nHarvest failed: ${err.message}`);
  process.exitCode = 1;
});
