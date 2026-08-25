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
/**
 * Which group to harvest. Guides by default; the 12 blog posts are the same
 * shape — one long self-contained article in a single widget — so they come
 * through here rather than through the block harvester, which would yield an
 * empty page for each.
 */
const GROUP = process.argv.find((a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]) ?? 'guide';
const OUT = resolve(ROOT, `data/pages/${GROUP}.json`);

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
 * Is the Spanish document still recognisably the SAME article?
 *
 * The Spanish body is taken whole from the /es/ page rather than paired node by
 * node, so the shape check is not guarding against misalignment — it is asking
 * "did TranslatePress serve a translation of this article, or something else?"
 *
 * Exact equality answered that too strictly. A blog post whose Spanish render
 * differed by ONE paragraph out of 63 was thrown away entirely — losing the
 * English page as well, which is a worse outcome than the thing being guarded
 * against. A genuinely broken Spanish page looks nothing like this: the one
 * real failure here collapsed 50 paragraphs, 11 h2s and a table down to a
 * single stray paragraph.
 *
 * So: allow a small absolute drift per tag, and require the big structural
 * counts to survive. Anything below that keeps its English body instead of
 * being deleted.
 */
function nearShape(a, b) {
  return Object.keys(a).every((k) => {
    const x = a[k] ?? 0;
    const y = b[k] ?? 0;
    if (x === y) return true;
    if (Math.abs(x - y) > Math.max(1, Math.round(x * 0.05))) return false;
    // A count that survives at all must not have essentially vanished.
    return x === 0 || y > x * 0.5;
  });
}

/**
 * The article widget. Usually an Elementor `html` widget, but three guides
 * paste the same self-contained article into a `text-editor` instead. Falls
 * back to the largest text-editor on the page, which on those pages is the
 * article and on any other page would not be mistaken for one.
 */
function articleContainer($) {
  // Three containers in practice, tried most-specific first:
  //   html                — most guides
  //   theme-post-content  — blog posts using Elementor's dynamic post body
  //   text-editor         — a handful of guides, matched only when very large
  for (const type of ['html', 'theme-post-content']) {
    const found = $(`#content .elementor-widget[data-widget_type^=${type}]`)
      .first()
      .find('.elementor-widget-container')
      .first();
    if (found.length && (found.html() ?? '').length > 500) return found;
  }

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
    // The page's own <h1>. Guides embed their heading INSIDE the article, but
    // blog posts render it in a separate widget that the article container does
    // not include — so without this, 12 posts shipped with no h1 at all while
    // the live site has one.
    h1: clean($('#content h1').first().text()),
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

/**
 * Core pages that are shaped like a guide rather than like a page: one long
 * self-contained article in a single widget. They belong here rather than in
 * the block harvester, which would yield an empty page for each.
 */
const EXTRA_ARTICLES = new Set([
  '/affiliate-program/',
  '/info-center/',
]);

async function main() {
  const routeData = JSON.parse(await readFile(resolve(ROOT, 'data/routes.json'), 'utf8'));
  let guides = routeData.routes.filter((r) =>
    r.es && (r.group === GROUP || (GROUP === 'guide' && EXTRA_ARTICLES.has(r.en))),
  );
  if (limit) guides = guides.slice(0, limit);

  console.log(`Harvesting ${guides.length} guides (${guides.length * 2} fetches)…\n`);

  const pages = [];
  const rejected = [];
  const degraded = [];
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
      // Three outcomes, not two: matching, close enough to trust, or Spanish
      // that cannot be trusted — in which case the page still ships in English
      // rather than disappearing from the site.
      const exact = sameShape(shapeEn, shapeEs);
      const near = exact || nearShape(shapeEn, shapeEs);
      if (!near) {
        degraded.push({
          ...route,
          reason: `shape differs EN ${JSON.stringify(shapeEn)} vs ES ${JSON.stringify(shapeEs)}`,
        });
      }

      pages.push({
        slug: route.en.replace(/^\/|\/$/g, ''),
        en: route.en,
        es: route.es,
        group: route.group,
        head: {
          title_en: en.head.title,
          title_es: near ? es.head.title : en.head.title,
          description_en: en.head.description,
          description_es: near ? es.head.description : en.head.description,
        },
        shape: shapeEn,
        // Recorded so the gap is measurable rather than invisible.
        ...(near ? {} : { untranslated: true }),
        // The converged section vocabulary — see scripts/migrate-shape.mjs.
        // A heading section is prepended only when the article does not already
        // carry its own <h1>, so guides are untouched and posts regain theirs.
        sections: [
          ...(/<h1[\s>]/i.test(en.html) || !en.h1
            ? []
            : [
                {
                  type: 'heading',
                  content: { level: 1, text_en: en.h1, text_es: (near && es.h1) || en.h1 },
                },
              ]),
          { type: 'article', content: { html_en: en.html, html_es: near ? es.html : en.html } },
        ],
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
      { harvestedAt: new Date().toISOString(), group: GROUP, count: pages.length, pages, rejected, degraded },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const words = pages.reduce(
    // Find the article section by type — its index moves once a heading is
    // prepended, so positional access would break.
    (n, p) =>
      n +
      (p.sections.find((x) => x.type === 'article')?.content.html_en ?? '')
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/).length,
    0,
  );
  console.log(`\nWrote ${pages.length}/${guides.length} ${GROUP} → data/pages/${GROUP}.json`);
  console.log(`~${words.toLocaleString()} English words captured`);
  if (rejected.length) {
    console.log(`\n${rejected.length} rejected — no article found:`);
    for (const r of rejected) console.log(`  ${r.en}\n     ${r.reason}`);
  }
  if (degraded.length) {
    console.log(
      `\n${degraded.length} kept in ENGLISH — the Spanish render is not the same article:`,
    );
    for (const r of degraded) console.log(`  ${r.en}\n     ${r.reason}`);
  }
}

main().catch((err) => {
  console.error(`\nharvest-guides failed: ${err.message}`);
  process.exit(1);
});
