/**
 * Harvest the 56 long-form guides into data/pages/guide.json, bilingual.
 *
 * WHY THESE ARE NOT BLOCKS
 *
 * The other page groups are built from discrete Elementor widgets, so
 * harvest-city.mjs can decompose them into a generic block vocabulary. The
 * guides are not: each one is a single self-contained HTML article pasted into
 * one Elementor `html` widget, ~3,000-3,700 words, with its own <style> scoped
 * to a wrapper class, a table of contents, tables, and inline links.
 *
 * Flattening that into heading/paragraph blocks would throw away the inline
 * markup, the tables and the styling — the article would survive but the guide
 * would not. So the article is kept as HTML and rendered as-is.
 *
 * WHY NO TRANSLATION PAIRING
 *
 * TranslatePress renders the Spanish article in the same widget, already
 * translated. So the Spanish is taken directly from the /es/ page rather than
 * reconstructed from string pairs — no positional matching, nothing to
 * misalign. Structural parity between the two is checked on every run.
 *
 * Usage:
 *   node scripts/harvest-guides.mjs
 *   node scripts/harvest-guides.mjs --limit 5
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/pages/guide.json');

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg === -1 ? null : Number(args[limitArg + 1]);

async function load(path) {
  const res = await fetch(ORIGIN + path, {
    headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return cheerio.load(await res.text());
}

/**
 * Strip anything executable and re-point absolute URLs at this site's own
 * paths, so the article carries no dependency on the WordPress origin.
 * The scoped <style> is deliberately KEPT — it is the guide's own layout, it is
 * namespaced to a wrapper class, and dropping it would leave unstyled markup.
 */
function sanitise($, root) {
  root.find('script,noscript,iframe,object,embed').remove();

  root.find('*').each((_, el) => {
    for (const attr of Object.keys(el.attribs ?? {})) {
      // on* handlers, and any javascript: target
      if (/^on/i.test(attr)) $(el).removeAttr(attr);
      if (/^(href|src|action)$/i.test(attr) && /^\s*javascript:/i.test(el.attribs[attr])) {
        $(el).removeAttr(attr);
      }
    }
  });

  const strip = (v) => (v || '').replace(new RegExp(`^${ORIGIN}`, 'i'), '') || '/';
  root.find('a[href]').each((_, el) => {
    const href = el.attribs.href;
    if (href.startsWith(ORIGIN)) $(el).attr('href', strip(href));
  });
  root.find('img[src]').each((_, el) => {
    $(el).attr('src', strip(el.attribs.src));
    $(el).attr('loading', 'lazy');
    $(el).removeAttr('srcset'); // the variants are not downloaded locally
    $(el).removeAttr('sizes');
  });

  return root.html() ?? '';
}

/** Counts that must agree between the two languages for the pair to be trusted. */
function shape(html) {
  const $ = cheerio.load(html);
  return {
    h2: $('h2').length,
    h3: $('h3').length,
    p: $('p').length,
    li: $('li').length,
    table: $('table').length,
  };
}

const sameShape = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

/**
 * The article widget. Usually an Elementor `html` widget, but three guides
 * paste the same self-contained article into a `text-editor` instead. Falls
 * back to the largest text-editor on the page, which on those pages is the
 * article and on any other page would not be mistaken for one.
 */
function articleContainer($) {
  const html = $('#content .elementor-widget[data-widget_type^=html]')
    .first()
    .find('.elementor-widget-container')
    .first();
  if (html.length) return html;

  let best = null;
  let bestLen = 0;
  $('#content .elementor-widget[data-widget_type^=text-editor]').each((_, el) => {
    const c = $(el).find('.elementor-widget-container').first();
    const len = (c.html() ?? '').length;
    if (len > bestLen) {
      bestLen = len;
      best = c;
    }
  });
  // A real guide article is thousands of words; a stray paragraph is not.
  return bestLen > 10000 ? best : null;
}

async function article(path) {
  const $ = await load(path);
  const container = articleContainer($);
  if (!container?.length) return null;

  const html = sanitise($, container);
  return {
    html,
    head: {
      title: clean($('title').first().text()),
      description: clean($('meta[name="description"]').attr('content')),
    },
  };
}

async function pool(items, size, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }),
  );
}

async function main() {
  const routeData = JSON.parse(await readFile(resolve(ROOT, 'data/routes.json'), 'utf8'));
  let guides = routeData.routes.filter((r) => r.group === 'guide' && r.es);
  if (limit) guides = guides.slice(0, limit);

  console.log(`Harvesting ${guides.length} guides (${guides.length * 2} fetches)…\n`);

  const pages = [];
  const rejected = [];
  let done = 0;

  await pool(guides, 5, async (route) => {
    try {
      const [en, es] = await Promise.all([article(route.en), article(route.es)]);
      if (!en || !es) {
        rejected.push({ ...route, reason: 'no html widget found' });
        return;
      }
      const shapeEn = shape(en.html);
      const shapeEs = shape(es.html);
      if (!sameShape(shapeEn, shapeEs)) {
        rejected.push({
          ...route,
          reason: `shape differs EN ${JSON.stringify(shapeEn)} vs ES ${JSON.stringify(shapeEs)}`,
        });
        return;
      }

      pages.push({
        slug: route.en.replace(/^\/|\/$/g, ''),
        en: route.en,
        es: route.es,
        head: {
          title_en: en.head.title,
          title_es: es.head.title,
          description_en: en.head.description,
          description_es: es.head.description,
        },
        shape: shapeEn,
        html_en: en.html,
        html_es: es.html,
      });
    } catch (err) {
      rejected.push({ ...route, reason: err.message });
    } finally {
      done += 1;
      if (done % 10 === 0) console.log(`  …${done}/${guides.length}`);
    }
  });

  pages.sort((a, b) => a.en.localeCompare(b.en));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group: 'guide', count: pages.length, pages, rejected },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const words = pages.reduce((n, p) => n + p.html_en.replace(/<[^>]+>/g, ' ').split(/\s+/).length, 0);
  console.log(`\nWrote ${pages.length}/${guides.length} guides → data/pages/guide.json`);
  console.log(`~${words.toLocaleString()} English words captured`);
  if (rejected.length) {
    console.log(`\n${rejected.length} rejected — EN/ES structure differs, not guessed at:`);
    for (const r of rejected) console.log(`  ${r.en}\n     ${r.reason}`);
  }
}

main().catch((err) => {
  console.error(`\nharvest-guides failed: ${err.message}`);
  process.exit(1);
});
