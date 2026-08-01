/**
 * Reconstruct the Spanish translations from the live site's rendered HTML.
 *
 * Writes:
 *   data/translations.json  — one merged EN→ES string dictionary
 *   data/wp-es/pages.json   — per-page title, meta description and string pairs
 *
 * WHY THIS EXISTS
 *
 * TranslatePress keeps its translations in its own wp_trp_dictionary_* tables
 * and will not surrender them over REST. Verified: ?lang=es,
 * trp-edit-translation=preview and /es/wp-json/ all return English, and every
 * trp_* admin-ajax action returns 400 to an unauthenticated caller.
 *
 * But the *rendered* /es/ HTML is the translation output — it is literally what
 * Spanish visitors read. So rather than asking for a database dump, this script
 * rebuilds the dictionary from the rendered pages: fetch the English and
 * Spanish copy of the same page, walk both DOMs in identical order, and pair
 * text node N with text node N.
 *
 * WHY POSITIONAL PAIRING IS SAFE HERE
 *
 * TranslatePress does not restructure the page. It serves the same WordPress
 * template with the same Elementor widgets in the same order and substitutes
 * strings in place. So the two documents are structurally identical and node N
 * really is the twin of node N.
 *
 * That assumption is checked rather than trusted: if the two documents yield
 * different node counts, the page is REJECTED and reported, not guessed at. A
 * missing translation is recoverable; a page silently paired one node out of
 * step would put the wrong Spanish under every heading on it.
 *
 * Untranslated strings (where ES === EN) are recorded too, and counted, since
 * "TranslatePress never translated this" is itself a finding the client needs.
 *
 * Usage:
 *   node scripts/harvest-es.mjs            # all routes
 *   node scripts/harvest-es.mjs --limit 10 # first 10, for a quick check
 *   node scripts/harvest-es.mjs --group city
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = resolve(ROOT, 'data/routes.json');
const OUT_DICT = resolve(ROOT, 'data/translations.json');
const OUT_PAGES = resolve(ROOT, 'data/wp-es/pages.json');

/** Present on every template checked — Elementor pages, blog posts, Woo
 *  products and the Astra city pages alike. Excludes header and footer, which
 *  are already harvested by harvest-global.mjs. */
const CONTAINER = '#content';

/** Never contributes visible copy, and script bodies differ between locales. */
const SKIP = 'script,style,noscript,svg,template';

/**
 * Widgets whose node count differs between languages for reasons that have
 * nothing to do with translation — review counts, testimonial rotations, the
 * currency switcher, and related-product grids whose prices format differently.
 *
 * On the product pages this drift rejected 46 of 67 pages. Removing these
 * subtrees before pairing makes the counts agree exactly.
 *
 * Scoped to wooProduct ON PURPOSE. nested-carousel is genuine translated copy
 * on the product landers, so excluding it globally would silently drop their
 * Spanish.
 */
const VOLATILE = [
  'rating',
  // elementskit-testimonial is NOT excluded. It was, until the block harvester
  // started capturing those quotes as real content — leaving 67 product pages
  // with English testimonials on their Spanish version. Verified it can stay:
  // the pages still pair exactly without excluding it.
  'shortcode',
  'woocommerce-product-add-to-cart',
  'nested-carousel',
]
  .map((t) => `.elementor-widget[data-widget_type^=${t}]`)
  .join(',');

const VOLATILE_GROUPS = new Set(['wooProduct']);

/**
 * Individual paths needing the same treatment. The home page carries the same
 * currency-switching product grids as a product page and drifted by a single
 * node, which was enough to reject it — leaving the Spanish home page with no
 * pairs at all.
 */
const VOLATILE_PATHS = new Set(['/']);

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const limit = Number(flag('limit')) || null;
const group = flag('group');

async function loadPage(path) {
  const res = await fetch(ORIGIN + path, {
    headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return cheerio.load(await res.text());
}

/**
 * Every visible text node inside the main content region, in document order.
 * Also captures alt text and input placeholders, which TranslatePress
 * translates and which carry real copy.
 */
function strings($, dropVolatile = false) {
  const root = $(CONTAINER).first();
  if (!root.length) return null;
  if (dropVolatile) root.find(VOLATILE).remove();

  const out = [];
  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (child.type === 'text') {
        const t = clean(child.data);
        if (t) out.push(t);
        continue;
      }
      if (child.type !== 'tag') continue;
      if (SKIP.split(',').includes(child.name)) continue;

      const alt = clean(child.attribs?.alt);
      if (alt) out.push(alt);
      const ph = clean(child.attribs?.placeholder);
      if (ph) out.push(ph);

      walk(child);
    }
  };
  walk(root[0]);
  return out;
}

const head = ($) => ({
  title: clean($('title').first().text()),
  description: clean($('meta[name="description"]').attr('content')),
});

async function pool(items, size, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }),
  );
}

async function main() {
  const { routes } = JSON.parse(await readFile(ROUTES, 'utf8'));
  let work = routes.filter((r) => r.es && r.en);
  if (group) work = work.filter((r) => r.group === group);
  if (limit) work = work.slice(0, limit);

  console.log(`Pairing ${work.length} routes (EN + ES = ${work.length * 2} fetches)…\n`);

  const pages = [];
  const rejected = [];
  const failed = [];
  const dict = new Map();
  let done = 0;

  await pool(work, 6, async (route) => {
    try {
      const [$en, $es] = await Promise.all([loadPage(route.en), loadPage(route.es)]);
      const drop = VOLATILE_GROUPS.has(route.group) || VOLATILE_PATHS.has(route.en);
      const en = strings($en, drop);
      const es = strings($es, drop);

      if (!en || !es) {
        rejected.push({ ...route, reason: `no ${CONTAINER} container` });
        return;
      }
      if (en.length !== es.length) {
        // Structural drift. Refuse rather than emit misaligned Spanish.
        rejected.push({ ...route, reason: `node count ${en.length} EN vs ${es.length} ES` });
        return;
      }

      const pairs = [];
      let untranslated = 0;
      for (let i = 0; i < en.length; i += 1) {
        pairs.push([en[i], es[i]]);
        if (en[i] === es[i]) untranslated += 1;
        else if (!dict.has(en[i])) dict.set(en[i], es[i]);
      }

      pages.push({
        en: route.en,
        es: route.es,
        group: route.group,
        head: { en: head($en), es: head($es) },
        counts: { strings: pairs.length, untranslated },
        pairs,
      });
    } catch (err) {
      failed.push({ ...route, reason: err.message });
    } finally {
      done += 1;
      if (done % 20 === 0) console.log(`  …${done}/${work.length}`);
    }
  });

  // --merge keeps the pairs already on disk for groups this run did not touch,
  // so a targeted re-harvest of one group cannot wipe the other 250 pages.
  let merged = { pages, rejected, failed };
  if (args.includes('--merge')) {
    const prior = JSON.parse(await readFile(OUT_PAGES, 'utf8'));
    const touched = new Set(work.map((r) => r.en));
    const keep = (list) => list.filter((p) => !touched.has(p.en));
    merged = {
      pages: [...keep(prior.pages ?? []), ...pages],
      rejected: [...keep(prior.rejected ?? []), ...rejected],
      failed: [...keep(prior.failed ?? []), ...failed],
    };
  }
  merged.pages.sort((a, b) => a.en.localeCompare(b.en));

  await mkdir(dirname(OUT_PAGES), { recursive: true });
  await writeFile(OUT_PAGES, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  // Built from the MERGED page set, not just this run's. Deriving it from
  // `dict` alone would shrink the dictionary to whichever group was last
  // harvested.
  const allPairs = new Map();
  for (const page of merged.pages) {
    for (const [en, es] of page.pairs) {
      if (en !== es && !allPairs.has(en)) allPairs.set(en, es);
    }
  }
  const sorted = [...allPairs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  await writeFile(
    OUT_DICT,
    `${JSON.stringify(
      {
        harvestedAt: new Date().toISOString(),
        source: 'rendered /es/ HTML — reconstructed, not a wp_trp_dictionary dump',
        count: sorted.length,
        entries: Object.fromEntries(sorted),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const totalStrings = pages.reduce((n, p) => n + p.counts.strings, 0);
  const totalUntranslated = pages.reduce((n, p) => n + p.counts.untranslated, 0);

  console.log(`\nPaired   ${pages.length}/${work.length} pages`);
  console.log(`Strings  ${totalStrings} (${totalUntranslated} identical in both languages)`);
  console.log(`Dictionary ${sorted.length} unique EN→ES entries → data/translations.json`);

  if (rejected.length) {
    console.log(`\n${rejected.length} rejected — structure differs, NOT guessed at:`);
    for (const r of rejected.slice(0, 25)) console.log(`  ${r.en}  (${r.reason})`);
    if (rejected.length > 25) console.log(`  …and ${rejected.length - 25} more`);
  }
  if (failed.length) {
    console.log(`\n${failed.length} failed to fetch:`);
    for (const f of failed.slice(0, 15)) console.log(`  ${f.en}  (${f.reason})`);
  }
}

main().catch((err) => {
  console.error(`\nharvest-es failed: ${err.message}`);
  process.exit(1);
});
