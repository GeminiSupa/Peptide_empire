/**
 * Harvest an Elementor-widget page group into data/pages/<group>.json,
 * bilingual, as a generic block list.
 *
 * Replaces the city-only harvester. The city pages and the product landers are
 * built from overlapping widget vocabularies, so one script with one vocabulary
 * covers both — and the marketing category pages, when their turn comes.
 *
 *   node scripts/harvest-blocks.mjs city
 *   node scripts/harvest-blocks.mjs productLander
 *   node scripts/harvest-blocks.mjs city productLander
 *
 * SOURCES
 *   English : data/wp/pages.json     (REST, authoritative structure)
 *   Spanish : data/wp-es/pages.json  (rendered /es/ HTML, positional pairs)
 *
 * TRANSLATION MATCHING — see translator() below. Anything unmatched keeps its
 * English and is counted, so gaps stay measurable rather than silent.
 *
 * Long-form guides do NOT come through here; they are single self-contained
 * HTML articles and are handled by scripts/harvest-guides.mjs.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const rel = (v) => (v ? v.replace(/^https?:\/\/[^/]+/, '') : null);
const read = async (p) => JSON.parse(await readFile(resolve(ROOT, p), 'utf8'));

/** Longest run of harvested nodes that may be joined to match one string. */
const MAX_RUN = 10;

/**
 * A consuming lookup over one page's [EN, ES] pairs.
 *
 * 1. Whole string. A string appearing twice with two different translations
 *    resolves to its Nth translation, not always the first.
 * 2. Consecutive run. Elementor splits a styled heading across several text
 *    nodes — a city h1 arrives as "Premium Peptides in" + "Naranjo Alajuela" —
 *    so harvested pairs are finer-grained than the strings pulled from
 *    content.rendered. This joins consecutive pairs until they equal the target.
 */
function translator(pairs = []) {
  const byEn = new Map();
  pairs.forEach(([en], i) => {
    if (!byEn.has(en)) byEn.set(en, []);
    byEn.get(en).push(i);
  });

  const consumed = new Set();
  const used = new Map();
  let hits = 0;
  let runHits = 0;
  let misses = 0;

  const runFrom = (start, target) => {
    let en = '';
    let es = '';
    for (let n = 0; n < MAX_RUN && start + n < pairs.length; n += 1) {
      if (consumed.has(start + n)) return null;
      en = en ? `${en} ${pairs[start + n][0]}` : pairs[start + n][0];
      es = es ? `${es} ${pairs[start + n][1]}` : pairs[start + n][1];
      if (en.length > target.length) return null;
      if (en === target) return { es, end: start + n };
    }
    return null;
  };

  const lookup = (en) => {
    const text = clean(en);
    if (!text) return { es: text, ok: true };

    const exact = byEn.get(text);
    if (exact?.length) {
      const nth = used.get(text) ?? 0;
      used.set(text, nth + 1);
      const idx = exact[Math.min(nth, exact.length - 1)];
      consumed.add(idx);
      hits += 1;
      return { es: pairs[idx][1], ok: true };
    }

    for (let start = 0; start < pairs.length; start += 1) {
      if (consumed.has(start) || !text.startsWith(pairs[start][0])) continue;
      const run = runFrom(start, text);
      if (!run) continue;
      for (let i = start; i <= run.end; i += 1) consumed.add(i);
      runHits += 1;
      return { es: run.es, ok: true };
    }

    misses += 1;
    return { es: text, ok: false };
  };

  lookup.stats = () => ({ hits, runHits, misses });
  return lookup;
}

/** `{ x_en, x_es }` from one English string. */
const bi = (key, en, tr) => ({ [`${key}_en`]: en, [`${key}_es`]: en ? tr(en).es : '' });

function widgetToBlock($, el, tr) {
  const $w = $(el);
  const type = ($w.attr('data-widget_type') ?? '').split('.')[0];
  const container = $w.find('.elementor-widget-container').first();

  if (type === 'heading') {
    const h = $w.find('h1,h2,h3,h4,h5,h6').first();
    const en = clean(h.text());
    if (!en) return null;
    return { type: 'heading', level: Number(h[0].tagName[1]) || 2, ...bi('text', en, tr) };
  }

  if (type === 'text-editor') {
    const kids = container.children('p,ul,ol,h4,h5,table').toArray();
    const nodes = kids.length ? kids : [container[0]];
    const out = [];
    for (const node of nodes) {
      if (!node) continue;
      const $n = $(node);

      if (node.tagName === 'table') {
        // Tables were previously flattened into a run-on paragraph.
        const rows = $n
          .find('tr')
          .toArray()
          .map((tr_) =>
            $(tr_)
              .find('th,td')
              .toArray()
              .map((c) => clean($(c).text())),
          )
          .filter((r) => r.some(Boolean));
        if (!rows.length) continue;
        const header = $n.find('thead th,thead td').length ? rows[0] : null;
        const body = header ? rows.slice(1) : rows;
        out.push({
          type: 'table',
          header_en: header,
          header_es: header ? header.map((c) => tr(c).es) : null,
          rows_en: body,
          rows_es: body.map((r) => r.map((c) => tr(c).es)),
        });
        continue;
      }

      if (node.tagName === 'ul' || node.tagName === 'ol') {
        const li = $n
          .find('li')
          .toArray()
          .map((l) => clean($(l).text()))
          .filter(Boolean);
        if (li.length) {
          out.push({
            type: 'list',
            ordered: node.tagName === 'ol',
            items_en: li,
            items_es: li.map((t) => tr(t).es),
          });
        }
        continue;
      }

      const en = clean($n.text());
      if (en) out.push({ type: 'paragraph', ...bi('text', en, tr) });
    }
    return out.length ? out : null;
  }

  if (type === 'icon-list') {
    const li = $w
      .find('.elementor-icon-list-text')
      .toArray()
      .map((l) => clean($(l).text()))
      .filter(Boolean);
    if (!li.length) return null;
    return { type: 'list', icon: true, items_en: li, items_es: li.map((t) => tr(t).es) };
  }

  if (type === 'button') {
    const a = $w.find('a').first();
    const en = clean(a.text());
    if (!en) return null;
    return { type: 'button', ...bi('text', en, tr), href: rel(a.attr('href')) };
  }

  if (type === 'image') {
    const img = $w.find('img').first();
    const src = img.attr('src');
    if (!src) return null;
    return { type: 'image', src: rel(src), ...bi('alt', clean(img.attr('alt')), tr) };
  }

  if (type === 'icon-box') {
    const title = clean($w.find('.elementor-icon-box-title').text());
    const text = clean($w.find('.elementor-icon-box-description').text());
    if (!title && !text) return null;
    return {
      type: 'card',
      ...bi('title', title, tr),
      ...bi('text', text, tr),
      href: rel($w.find('a').first().attr('href')),
    };
  }

  if (type === 'divider') {
    const en = clean($w.find('.elementor-divider__text').text());
    return en ? { type: 'heading', level: 2, ...bi('text', en, tr) } : null;
  }

  // Elementor's nested tabs: titles and panes are siblings in document order.
  if (type === 'nested-tabs') {
    const titles = $w.find('.e-n-tab-title').toArray();
    const panes = $w.find('.e-n-tabs-content > .e-con').toArray();
    const items = [];
    for (let i = 0; i < titles.length; i += 1) {
      const label = clean($(titles[i]).text());
      const body = clean($(panes[i]).text());
      if (!label) continue;
      items.push({ ...bi('label', label, tr), ...bi('body', body, tr) });
    }
    return items.length ? { type: 'tabs', items } : null;
  }

  if (type === 'nested-carousel') {
    const slides = $w.find('.swiper-slide').toArray();
    const items = [];
    for (const slide of slides) {
      const $s = $(slide);
      const title = clean($s.find('h1,h2,h3,h4,h5,h6').first().text());
      const full = clean($s.text());
      const text = title && full.startsWith(title) ? clean(full.slice(title.length)) : full;
      if (!title && !text) continue;
      items.push({ ...bi('title', title, tr), ...bi('text', text, tr) });
    }
    return items.length ? { type: 'cards', items } : null;
  }

  if (type === 'elementskit-accordion' || type === 'nested-accordion') {
    const items = [];
    if (type === 'nested-accordion') {
      const qs = $w.find('.e-n-accordion-item-title-text').toArray();
      const as = $w.find('.e-n-accordion-item > .e-con').toArray();
      for (let i = 0; i < qs.length; i += 1) {
        const q = clean($(qs[i]).text());
        if (q) items.push({ ...bi('q', q, tr), ...bi('a', clean($(as[i]).text()), tr) });
      }
    } else {
      $w.find('.elementskit-card').each((_, card) => {
        const $c = $(card);
        const q = clean($c.find('.elementskit-btn-link, .elementskit-card-header').first().text());
        const a = clean($c.find('.elementskit-card-body').first().text());
        if (q) items.push({ ...bi('q', q, tr), ...bi('a', a, tr) });
      });
    }
    return items.length ? { type: 'faq', items } : null;
  }

  // A WooCommerce product grid. This project sells nothing: the cart lives on
  // the catalog site, so only the display data is kept and the renderer sends
  // every buy action there. No price is trusted as live — see the renderer.
  if (type === 'shortcode') {
    // The lab-tests page: a searchable list of certificate-of-analysis PDFs,
    // one per product. Not a product grid, so it is matched first.
    const coa = $w.find('.pcoa-acf-item').toArray();
    if (coa.length) {
      const items = coa
        .map((item) => {
          const $i = $(item);
          const link = $i.find('.pcoa-acf-item-link').first();
          const name = clean(link.text());
          if (!name) return null;
          return {
            name,
            href: rel(link.attr('href') ?? link.find('a').first().attr('href')),
            // Absolute on the live site; these PDFs are NOT yet mirrored into
            // public/, so they still resolve against the WordPress origin.
            pdf: rel($i.find('.pcoa-acf-item-btn').first().attr('href')),
            ...bi('tag', clean($i.find('.pcoa-acf-item-tag').first().text()), tr),
          };
        })
        .filter(Boolean);
      if (items.length) return { type: 'coa_list', items };
    }

    const products = [];
    $w.find('li.product').each((_, li) => {
      const $p = $(li);
      const name = clean($p.find('.woocommerce-loop-product__title').text());
      if (!name) return;
      products.push({
        name,
        price: clean($p.find('.price').text()),
        href: rel($p.find('a').first().attr('href')),
        image: rel($p.find('img').first().attr('src')),
      });
    });
    return products.length ? { type: 'product_grid', products } : null;
  }

  return null;
}

/**
 * Paths this script must not harvest, and why.
 *
 * Not "pages we haven't got to" — pages whose content does not live in
 * Elementor widgets at all, so a block harvest produces a plausible-looking
 * empty page rather than an honest failure.
 */
const SKIP = new Map([
  ['/', 'home — harvested separately by harvest-home.mjs into an ordered section array'],
  ['/affiliate-program/', 'one long article — harvest-guides.mjs handles it'],
  ['/info-center/', 'one long article — harvest-guides.mjs handles it'],
  ['/blog/', 'dynamic index (loop-grid) — must be built from our own post data'],
  ['/peptide-guides/', 'dynamic index (loop-grid) — must be built from our own guide data'],
  ['/shop/', 'WooCommerce archive — no Elementor content at all'],
]);

async function harvestGroup(group, { wpByPath, esByEn, routes }) {
  const out = [];
  let hits = 0;
  let misses = 0;
  const noSpanish = [];
  const skipped = [];

  for (const route of routes.filter((r) => r.group === group)) {
    if (SKIP.has(route.en)) {
      skipped.push([route.en, SKIP.get(route.en)]);
      continue;
    }
    const wp = wpByPath.get(route.en);
    if (!wp) continue;
    const es = esByEn.get(route.en);
    if (!es) noSpanish.push(route.en);

    const tr = translator(es?.pairs);
    const $ = cheerio.load(wp.content.rendered);
    const blocks = [];
    for (const el of $('.elementor-widget').toArray()) {
      const block = widgetToBlock($, el, tr);
      if (!block) continue;
      if (Array.isArray(block)) blocks.push(...block);
      else blocks.push(block);
    }

    const stats = tr.stats();
    hits += stats.hits + stats.runHits;
    misses += stats.misses;

    const title = clean(wp.title.rendered);
    out.push({
      slug: wp.slug,
      en: route.en,
      es: route.es,
      head: {
        title_en: es?.head?.en?.title ?? title,
        title_es: es?.head?.es?.title ?? title,
        description_en: es?.head?.en?.description ?? '',
        description_es: es?.head?.es?.description ?? '',
      },
      blocks,
      untranslated: stats.misses,
    });
  }

  const file = resolve(ROOT, `data/pages/${group}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group, count: out.length, pages: out },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const blocks = out.reduce((n, p) => n + p.blocks.length, 0);
  const kinds = {};
  for (const p of out) for (const b of p.blocks) kinds[b.type] = (kinds[b.type] ?? 0) + 1;

  console.log(`\n${group}: ${out.length} pages · ${blocks} blocks → data/pages/${group}.json`);
  console.log(`  Spanish: ${hits} matched, ${misses} fell back to English`);
  console.log(
    `  blocks: ${Object.entries(kinds)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ')}`,
  );
  if (noSpanish.length) console.log(`  ${noSpanish.length} pages had no Spanish pairs`);
  if (skipped.length) {
    console.log(`  skipped ${skipped.length}, deliberately:`);
    for (const [path, why] of skipped) console.log(`    ${path} — ${why}`);
  }
}

async function main() {
  const groups = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!groups.length) {
    console.error('Usage: node scripts/harvest-blocks.mjs <group> [group…]');
    process.exit(1);
  }

  const [wpPages, esData, routeData] = await Promise.all([
    read('data/wp/pages.json'),
    read('data/wp-es/pages.json'),
    read('data/routes.json'),
  ]);

  const ctx = {
    wpByPath: new Map(wpPages.map((p) => [new URL(p.link).pathname, p])),
    esByEn: new Map(esData.pages.map((p) => [p.en, p])),
    routes: routeData.routes,
  };

  for (const group of groups) await harvestGroup(group, ctx);
}

main().catch((err) => {
  console.error(`\nharvest-blocks failed: ${err.message}`);
  process.exit(1);
});
