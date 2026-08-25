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

import { writeFile, mkdir, readFile } from 'node:fs/promises';
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

const args = process.argv.slice(2);

const toPath = (url) => url.replace(ORIGIN, '') || '/';

/**
 * The `guide` custom post type, at /blog/guide/<slug>/.
 *
 * These 15 mixing-and-dosage guides have NO Xagio sitemap of their own and do
 * not appear in /html-sitemap/ either, so both of this script's normal sources
 * are blind to them — which is why the clone had none of them and the
 * /peptide-guides/ index, which lists exactly these, had nothing real to list.
 *
 * The REST API does expose the type, so it is the source here. The Spanish twin
 * cannot be paired positionally for the same reason (not in the HTML sitemap),
 * so each one is resolved the authoritative way instead: ask the site where
 * /es/blog/guide/<slug>/ redirects to.
 */
async function mixingGuideRoutes() {
  const res = await fetch(
    `${ORIGIN}/wp-json/wp/v2/guide?per_page=100&_fields=slug,link`,
    { headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' } },
  );
  if (!res.ok) throw new Error(`/wp-json/wp/v2/guide → HTTP ${res.status}`);
  const entries = await res.json();

  const out = [];
  // Serialised: the site refuses connections under concurrency.
  for (const entry of entries) {
    const en = toPath(entry.link);
    let es = null;
    try {
      const probe = await fetch(`${ORIGIN}/es/blog/guide/${entry.slug}/`, {
        headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
        redirect: 'follow',
      });
      if (probe.ok) {
        const landed = toPath(probe.url);
        if (landed.startsWith('/es/')) es = landed;
      }
    } catch {
      // Leave es null; missingEs reports it rather than guessing a slug.
    }
    out.push({ en, es });
  }
  return out;
}

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

/**
 * Fetch the live URL inventory: the sitemaps, plus the REST fallback for the
 * product categories whose sitemap is gone.
 */
/**
 * Keep a newly discovered Spanish path on the scheme this site already uses.
 *
 * The live WordPress has renamed its Spanish post-type bases — /es/producto-2/
 * became /es/producto/, /es/categoria-producto-2/ became
 * /es/categoria-producto/ — so following a redirect for a NEW product returns
 * the new base while the 67 products already mapped keep the old one. Left
 * alone that mixes two schemes in one route table and points the new pages at
 * URLs this app does not serve.
 *
 * The `-2` bases are the ones documented as indexed SEO (docs/url-inventory.md)
 * and are what app/es/producto-2/ and app/es/categoria-producto-2/ render, so
 * they stay canonical here until someone decides to migrate all of them at once.
 */
const ES_BASE_ALIASES = [
  [/^\/es\/producto\//, '/es/producto-2/'],
  [/^\/es\/categoria-producto\//, '/es/categoria-producto-2/'],
  [/^\/es\/shop\/$/, '/es/tienda/'],
];

const canonicalEs = (es) => {
  if (!es) return es;
  for (const [pattern, base] of ES_BASE_ALIASES) {
    if (pattern.test(es)) return es.replace(pattern, base);
  }
  return es;
};

async function fetchInventory() {
  const [pageXml, productXml, postXml] = await Promise.all([
    get('/sitemap-xagio-page.xml'),
    get('/sitemap-xagio-product.xml'),
    get('/sitemap-xagio-post.xml'),
  ]);

  let wooCategories;
  try {
    wooCategories = locs(await get('/sitemap-xagio-product_cat.xml'));
  } catch (err) {
    const cats = JSON.parse(await readFile(resolve(ROOT, 'data/wp/product_cat.json'), 'utf8'));
    wooCategories = cats.map((c) => toPath(c.link));
    console.log(
      `  product-category sitemap unavailable (${err.message}) — using the ${wooCategories.length} in data/wp/product_cat.json`,
    );
  }

  return {
    pages: locs(pageXml),
    wooProducts: locs(productXml),
    posts: locs(postXml),
    wooCategories,
  };
}

/** Sort the English inventory into the site's page groups. */
function classify({ pages, wooProducts, posts, wooCategories }) {
  const known = new Set([...CORE_PAGES, ...LEGAL_PAGES, ...CATEGORY_PAGES, ...EXCLUDE_CANDIDATES]);

  const productLanders = pages.filter(
    (p) => (p.endsWith('-costa-rica/') || p === '/bpc-157-tb-500-wolverine-stack/') && !known.has(p)
  );
  const cityPages = pages.filter(isCityPage);

  const claimed = new Set([...known, ...productLanders, ...cityPages]);
  const guides = pages.filter((p) => !claimed.has(p));

  return {
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
}

/**
 * Ask the live site where the Spanish twin of an English path is.
 *
 * TranslatePress 301s /es/<english-slug>/ to the translated slug, so this is
 * the authoritative per-page answer — and unlike the positional pairing from
 * the two HTML sitemaps, it cannot drift out of alignment.
 */
async function spanishTwin(en) {
  try {
    const res = await fetch(`${ORIGIN}/es${en}`, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const landed = toPath(res.url);
    return landed.startsWith('/es/') ? landed : null;
  } catch {
    return null;
  }
}

async function main() {
  /**
   * Additive mode: add the guide CPT to an existing routes.json, touching
   * nothing else.
   *
   * A full run rebuilds the whole map from the live site, and the live site has
   * since changed its Spanish slug scheme (/es/tienda/ → /es/shop/,
   * /es/producto-2/ → /es/producto/). Adopting that is an SEO decision about
   * ~97 indexed URLs, not a side effect anyone should get from re-running a
   * harvest to pick up 15 new pages. So this mode exists to do exactly the
   * additive part, and the spot-check guard still protects the full run.
   */
  /**
   * Additive mode: add pages the live site has and routes.json does not,
   * touching nothing that is already mapped.
   *
   * A full run rebuilds the whole map, and the live site has since changed its
   * Spanish slug scheme (/es/tienda/ → /es/shop/, /es/producto-2/ →
   * /es/producto/, /es/categoria-producto-2/ → /es/categoria-producto/).
   * Adopting that is an SEO decision about ~97 indexed URLs and must be made
   * deliberately, not picked up as a side effect of harvesting new pages — so
   * the spot-check guard on the full run is left in place to force the
   * decision, and this mode exists to do the purely additive part meanwhile.
   *
   * Spanish twins here come from following each page's own /es/ redirect rather
   * than from the positional sitemap pairing, which is both authoritative and
   * immune to the alignment problem the guard exists to catch.
   */
  if (args.includes('--add-new')) {
    const existing = JSON.parse(await readFile(OUT, 'utf8'));
    const have = new Set(existing.routes.map((r) => r.en));

    console.log('Fetching XML sitemaps…');
    const inventory = await fetchInventory();
    const groups = classify(inventory);

    console.log('Fetching the guide custom post type from the REST API…');
    const cptGuides = await mixingGuideRoutes();

    const discovered = [];
    for (const [group, paths] of Object.entries(groups)) {
      for (const en of paths) if (!have.has(en)) discovered.push({ en, group });
    }
    for (const g of cptGuides) {
      if (!have.has(g.en)) discovered.push({ en: g.en, group: 'mixingGuide', es: canonicalEs(g.es) });
    }

    if (!discovered.length) {
      console.log('\nNothing new — routes.json already has every live URL.');
      return;
    }

    console.log(`\n${discovered.length} new URL(s); resolving Spanish twins…`);
    for (const entry of discovered) {
      // Serialised: the site refuses connections under concurrency.
      if (entry.es === undefined) entry.es = canonicalEs(await spanishTwin(entry.en));
      if (!entry.es) existing.missingEs.push(entry.en);
      existing.routes.push({ en: entry.en, es: entry.es, group: entry.group });
      console.log(`  + [${entry.group}] ${entry.en}  ←→  ${entry.es ?? '(no Spanish twin)'}`);
    }

    const counts = {};
    for (const r of existing.routes) counts[r.group] = (counts[r.group] ?? 0) + 1;
    existing.counts = {
      ...counts,
      totalEn: existing.routes.length,
      totalEs: existing.routes.filter((r) => r.es).length,
    };

    await writeFile(OUT, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    console.log(`\nAdded ${discovered.length} route(s) → ${OUT}`);
    console.table(counts);
    return;
  }

  console.log('Fetching XML sitemaps…');
  const [pageXml, productXml, postXml] = await Promise.all([
    get('/sitemap-xagio-page.xml'),
    get('/sitemap-xagio-product.xml'),
    get('/sitemap-xagio-post.xml'),
  ]);

  const pages = locs(pageXml);
  const wooProducts = locs(productXml);
  const posts = locs(postXml);

  /**
   * Product categories, from the REST snapshot when their sitemap is gone.
   *
   * /sitemap-xagio-product_cat.xml now 404s on the live site, and because every
   * sitemap was required this script could no longer run at all — which is why
   * data/routes.json went stale and the clone lost pages the live site still
   * serves. The categories are already in data/wp/product_cat.json, so a dead
   * sitemap costs nothing; falling back is better than refusing to regenerate.
   */
  let wooCategories;
  try {
    wooCategories = locs(await get('/sitemap-xagio-product_cat.xml'));
  } catch (err) {
    const cats = JSON.parse(await readFile(resolve(ROOT, 'data/wp/product_cat.json'), 'utf8'));
    wooCategories = cats.map((c) => toPath(c.link));
    console.log(
      `  product-category sitemap unavailable (${err.message}) — using the ${wooCategories.length} in data/wp/product_cat.json`,
    );
  }

  console.log('Fetching the guide custom post type from the REST API…');
  const mixingGuides = await mixingGuideRoutes();
  console.log(`  ${mixingGuides.length} guides · ${mixingGuides.filter((g) => g.es).length} with a Spanish twin`);

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

  // The CPT guides carry their own resolved Spanish twin, so they bypass the
  // positional `pairs` map entirely.
  for (const { en, es } of mixingGuides) {
    if (!es) missingEs.push(en);
    routes.push({ en, es, group: 'mixingGuide' });
  }

  // Anything in a sitemap that no group claimed is a classification bug.
  const grouped = new Set(routes.map((r) => r.en));
  const unclassified = [...pages, ...wooProducts, ...wooCategories, ...posts].filter(
    (p) => !grouped.has(p)
  );
  if (unclassified.length > 0) {
    throw new Error(`Unclassified URLs (fix the grouping rules):\n  ${unclassified.join('\n  ')}`);
  }

  const counts = Object.fromEntries([
    ...Object.entries(groups).map(([k, v]) => [k, v.length]),
    ['mixingGuide', mixingGuides.length],
  ]);

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
