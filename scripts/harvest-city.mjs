/**
 * Harvest the 93 city pages into data/pages/city.json, bilingual.
 *
 * Output shape, one entry per city:
 *   { slug, en, es, head: {…_en/_es}, blocks: [ { type, …_en, …_es } ] }
 *
 * Blocks are a small, generic vocabulary — heading, paragraph, list, button,
 * image, faq — rather than a component per Elementor widget. The 93 pages come
 * in 3 structural variants, and a generic block list absorbs all three without
 * a branch per variant. It also means new pages in other groups can reuse the
 * same renderer.
 *
 * SOURCES
 *   English : data/wp/pages.json         (REST, authoritative structure)
 *   Spanish : data/wp-es/pages.json      (rendered /es/ HTML, positional pairs)
 *
 * TRANSLATION MATCHING
 *
 * The Spanish harvest yields per-page [EN, ES] pairs in document order. This
 * script matches each English string it extracts against that page's pair list,
 * consuming matches in order so that a string appearing twice on a page with
 * two different translations still resolves correctly.
 *
 * A string with no Spanish match keeps its English and is counted. That is
 * visible in the output as `untranslated`, so gaps are measurable rather than
 * silent — see the summary this prints.
 *
 * Usage: node scripts/harvest-city.mjs
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/pages/city.json');

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

const read = async (p) => JSON.parse(await readFile(resolve(ROOT, p), 'utf8'));

/** Longest run of harvested nodes that may be joined to match one string. */
const MAX_RUN = 10;

/**
 * A consuming lookup over one page's [EN, ES] pairs.
 *
 * Two matching strategies, in order:
 *
 * 1. Whole string. Repeated English strings resolve to their Nth translation
 *    rather than always the first.
 *
 * 2. Consecutive run. Elementor splits a styled heading across several text
 *    nodes — the city page h1 arrives as "Premium Peptides in" + "Naranjo
 *    Alajuela" — so the harvested pairs are finer-grained than the strings
 *    pulled from content.rendered, and a whole-string lookup misses. This joins
 *    consecutive pairs until they equal the target and returns their
 *    translations joined the same way.
 *
 * Anything still unmatched keeps its English and is counted, so gaps stay
 * measurable instead of silent.
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

  /** Join pairs [start, start+len) and test against the target. */
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

/** Widget → block. Returns null for widgets that carry no copy. */
function widgetToBlock($, el, tr) {
  const $w = $(el);
  const type = $w.attr('data-widget_type') ?? '';

  if (type.startsWith('heading')) {
    const h = $w.find('h1,h2,h3,h4,h5,h6').first();
    if (!h.length) return null;
    const en = clean(h.text());
    if (!en) return null;
    return { type: 'heading', level: Number(h[0].tagName[1]) || 2, text_en: en, text_es: tr(en).es };
  }

  if (type.startsWith('text-editor')) {
    const paras = $w
      .find('.elementor-widget-container')
      .first()
      .children('p,ul,ol,h4,h5')
      .toArray();
    const source = paras.length ? paras : [$w.find('.elementor-widget-container').first()[0]];
    const items = [];
    for (const node of source) {
      if (!node) continue;
      const $n = $(node);
      if (node.tagName === 'ul' || node.tagName === 'ol') {
        const li = $n
          .find('li')
          .toArray()
          .map((l) => clean($(l).text()))
          .filter(Boolean);
        if (li.length) {
          items.push({
            type: 'list',
            ordered: node.tagName === 'ol',
            items_en: li,
            items_es: li.map((t) => tr(t).es),
          });
        }
        continue;
      }
      const en = clean($n.text());
      if (en) items.push({ type: 'paragraph', text_en: en, text_es: tr(en).es });
    }
    return items.length ? items : null;
  }

  if (type.startsWith('icon-list')) {
    const li = $w
      .find('.elementor-icon-list-text')
      .toArray()
      .map((l) => clean($(l).text()))
      .filter(Boolean);
    if (!li.length) return null;
    return { type: 'list', ordered: false, icon: true, items_en: li, items_es: li.map((t) => tr(t).es) };
  }

  if (type.startsWith('button')) {
    const a = $w.find('a').first();
    const en = clean(a.text());
    if (!en) return null;
    return { type: 'button', text_en: en, text_es: tr(en).es, href: a.attr('href') ?? null };
  }

  if (type.startsWith('image')) {
    const img = $w.find('img').first();
    const src = img.attr('src');
    if (!src) return null;
    const alt = clean(img.attr('alt'));
    return {
      type: 'image',
      src: src.replace(/^https?:\/\/[^/]+/, ''),
      alt_en: alt,
      alt_es: alt ? tr(alt).es : '',
    };
  }

  if (type.startsWith('icon-box')) {
    const h = clean($w.find('.elementor-icon-box-title').text());
    const d = clean($w.find('.elementor-icon-box-description').text());
    const a = $w.find('a').first().attr('href') ?? null;
    if (!h && !d) return null;
    return {
      type: 'card',
      title_en: h,
      title_es: h ? tr(h).es : '',
      text_en: d,
      text_es: d ? tr(d).es : '',
      href: a ? a.replace(/^https?:\/\/[^/]+/, '') : null,
    };
  }

  if (type.startsWith('nested-accordion')) {
    const qs = $w.find('.e-n-accordion-item-title-text').toArray();
    const as = $w.find('.e-n-accordion-item > .e-con').toArray();
    const items = [];
    for (let i = 0; i < qs.length; i += 1) {
      const q = clean($(qs[i]).text());
      const a = clean($(as[i]).text());
      if (!q) continue;
      items.push({ q_en: q, q_es: tr(q).es, a_en: a, a_es: a ? tr(a).es : '' });
    }
    return items.length ? { type: 'faq', items } : null;
  }

  return null;
}

async function main() {
  const [wpPages, esData, routeData] = await Promise.all([
    read('data/wp/pages.json'),
    read('data/wp-es/pages.json'),
    read('data/routes.json'),
  ]);

  const cityRoutes = routeData.routes.filter((r) => r.group === 'city');
  const esByEn = new Map(esData.pages.map((p) => [p.en, p]));
  const wpByPath = new Map(wpPages.map((p) => [new URL(p.link).pathname, p]));

  const out = [];
  const noSpanish = [];
  let totalHits = 0;
  let totalMisses = 0;

  for (const route of cityRoutes) {
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

    const titleEn = clean(wp.title.rendered);
    const { hits, runHits, misses } = tr.stats();
    totalHits += hits + runHits;
    totalMisses += misses;

    out.push({
      slug: wp.slug,
      en: route.en,
      es: route.es,
      head: {
        title_en: es?.head?.en?.title ?? titleEn,
        title_es: es?.head?.es?.title ?? titleEn,
        description_en: es?.head?.en?.description ?? '',
        description_es: es?.head?.es?.description ?? '',
      },
      blocks,
      untranslated: misses,
    });
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group: 'city', count: out.length, pages: out },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const blocks = out.reduce((n, p) => n + p.blocks.length, 0);
  console.log(`Wrote ${out.length} city pages · ${blocks} blocks → data/pages/city.json`);
  console.log(`Spanish: ${totalHits} strings matched, ${totalMisses} fell back to English`);
  if (noSpanish.length) {
    console.log(`\n${noSpanish.length} pages had no Spanish harvest yet:`);
    for (const p of noSpanish.slice(0, 10)) console.log(`  ${p}`);
    if (noSpanish.length > 10) console.log(`  …and ${noSpanish.length - 10} more`);
  }
}

main().catch((err) => {
  console.error(`\nharvest-city failed: ${err.message}`);
  process.exit(1);
});
