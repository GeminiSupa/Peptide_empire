/**
 * Harvest the `guide` custom post type — the mixing & dosage guides at
 * /blog/guide/<slug>/ — into data/pages/mixingGuide.json, bilingual.
 *
 * WHY THIS IS ITS OWN SCRIPT
 *
 * These 15 pages were missing from the clone entirely, and every existing
 * harvester had a good reason to skip them:
 *
 *   - harvest-routes.mjs never saw them. They have no Xagio sitemap of their
 *     own and are absent from /html-sitemap/, so both of its sources are blind
 *     to the type. It now pulls them from the REST API instead.
 *   - harvest-guides.mjs rejected 14 of 15 with "no html widget found". The
 *     long-form guides are one self-contained article pasted into an Elementor
 *     `html` widget; these are not that shape at all.
 *   - harvest-blocks.mjs would have produced almost nothing, because the body
 *     is not built from Elementor widgets either.
 *
 * WHAT THEY ACTUALLY ARE
 *
 * An Elementor POST TEMPLATE with three widgets — post title, post featured
 * image, post content — wrapped around a very short body: one or two
 * paragraphs, and an infographic carrying the actual reference table as a
 * picture. So the whole page is a heading, an image and a little prose, and it
 * maps onto the shared section vocabulary directly.
 *
 * The infographic is the page. Losing it would leave a paragraph saying "the
 * infographic below explains…" followed by nothing, so a guide whose featured
 * image cannot be found is rejected rather than written.
 *
 * SPANISH
 *
 * TranslatePress renders the translated page at the /es/ twin resolved in
 * routes.json. Text is paired POSITIONALLY — paragraph N with paragraph N —
 * which is safe here only because the template is fixed and the body is a
 * couple of paragraphs; a structural difference between the two languages is
 * rejected rather than guessed at, matching harvest-guides.mjs.
 *
 * Usage:
 *   node scripts/harvest-mixing-guides.mjs
 *   node scripts/harvest-mixing-guides.mjs --limit 3
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/pages/mixingGuide.json');
const GROUP = 'mixingGuide';

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg === -1 ? null : Number(args[limitArg + 1]);

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
/**
 * A URL reduced to a site-relative path — but ONLY when it is ours.
 *
 * Stripping the host from every URL turned the contact page's Google Maps link
 * (https://maps.app.goo.gl/AgpzEd8NNRKYNbJj9) into `/AgpzEd8NNRKYNbJj9`, a
 * broken internal link. Another origin has to stay absolute.
 * Mirrors rel() in scripts/harvest-global.mjs.
 */
const rel = (h) => {
  const v = (h || '').trim();
  if (!v) return null;
  return v.startsWith(ORIGIN) ? v.slice(ORIGIN.length) || '/' : v;
};

async function load(path, attempt = 1) {
  try {
    const res = await fetch(ORIGIN + path, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return cheerio.load(await res.text());
  } catch (err) {
    if (attempt >= 4) throw new Error(`${path} → ${err.message}`);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return load(path, attempt + 1);
  }
}

/**
 * The real URL behind a lazy-loaded <img>.
 *
 * The live site runs Breeze, which replaces `src` with an inline SVG spacer of
 * the right aspect ratio and keeps the true candidates in `data-brsrcset`.
 * Reading `src` alone would mirror the spacer and lose the infographic.
 */
function imageSrc($, el) {
  const a = el.attribs ?? {};
  const candidates = a['data-brsrcset'] || a.srcset || '';
  const widest = candidates
    .split(',')
    .map((c) => c.trim().split(/\s+/))
    .filter(([url]) => url && !url.startsWith('data:'))
    .map(([url, w]) => [url, parseInt(w, 10) || 0])
    .sort((x, y) => y[1] - x[1])[0];
  if (widest) return rel(widest[0]);

  for (const key of ['data-brsrc', 'data-lazy-src', 'data-src', 'src']) {
    const v = a[key];
    if (v && !v.startsWith('data:')) return rel(v);
  }
  return null;
}

/**
 * Reduce one rendered guide to its title, infographic and prose.
 *
 * Scoped to the post-content and featured-image widgets rather than to
 * `#content` as a whole: the template also renders related-post and navigation
 * blocks that belong to the chrome, not to the guide.
 */
function extract($) {
  const scope = $('#content').length ? $('#content') : $('body');

  const title =
    clean(scope.find('[data-widget_type^="theme-post-title"] h1').first().text()) ||
    clean(scope.find('h1').first().text());

  const featured = scope.find('[data-widget_type^="theme-post-featured-image"] img').first();
  const body = scope.find('[data-widget_type^="theme-post-content"]').first();

  const image = featured.length ? imageSrc($, featured[0]) : null;
  const alt = featured.length ? clean(featured.attr('alt')) : '';

  const paragraphs = [];
  body.find('p').each((_, el) => {
    const text = clean($(el).text());
    if (text) paragraphs.push(text);
  });

  // Images sitting inside the body, after the featured one.
  const bodyImages = [];
  body.find('img').each((_, el) => {
    const src = imageSrc($, el);
    if (src) bodyImages.push({ src, alt: clean($(el).attr('alt')) });
  });

  return {
    title,
    image,
    alt,
    paragraphs,
    bodyImages,
    head: {
      title: clean($('title').first().text()),
      description: clean($('meta[name="description"]').attr('content')),
    },
  };
}

async function main() {
  const routeData = JSON.parse(await readFile(resolve(ROOT, 'data/routes.json'), 'utf8'));
  let routes = routeData.routes.filter((r) => r.group === GROUP);
  if (limit) routes = routes.slice(0, limit);

  if (!routes.length) {
    throw new Error(
      `No ${GROUP} routes in data/routes.json — run: node scripts/harvest-routes.mjs --add-new`,
    );
  }

  const pages = [];
  const rejected = [];

  for (const route of routes) {
    try {
      const en = extract(await load(route.en));
      if (!en.title) throw new Error('no post title found');
      if (!en.image) throw new Error('no featured image found — the infographic IS the guide');

      let es = en;
      if (route.es) {
        const candidate = extract(await load(route.es));
        // Positional pairing is only valid while the two sides match.
        if (candidate.paragraphs.length !== en.paragraphs.length) {
          throw new Error(
            `EN/ES structure differs: ${en.paragraphs.length} vs ${candidate.paragraphs.length} paragraphs`,
          );
        }
        es = candidate;
      }

      const sections = [
        { type: 'heading', content: { level: 1, text_en: en.title, text_es: es.title || en.title } },
        {
          type: 'image',
          content: { src: en.image, alt_en: en.alt, alt_es: es.alt || en.alt },
        },
        ...en.paragraphs.map((text, i) => ({
          type: 'paragraph',
          content: { text_en: text, text_es: es.paragraphs[i] ?? text },
        })),
        ...en.bodyImages
          // The featured image is already the section above it.
          .filter((img) => img.src !== en.image)
          .map((img, i) => ({
            type: 'image',
            content: {
              src: img.src,
              alt_en: img.alt,
              alt_es: es.bodyImages[i]?.alt ?? img.alt,
            },
          })),
      ];

      pages.push({
        slug: route.en.replace(/^\/|\/$/g, ''),
        en: route.en,
        es: route.es,
        group: GROUP,
        head: {
          title_en: en.head.title,
          title_es: es.head.title || en.head.title,
          description_en: en.head.description,
          description_es: es.head.description || en.head.description,
        },
        image: en.image,
        sections,
      });
      console.log(`  ✓ ${route.en}  (${en.paragraphs.length} paragraphs)`);
    } catch (err) {
      rejected.push({ path: route.en, reason: err.message });
      console.log(`  ✗ ${route.en} — ${err.message}`);
    }
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group: GROUP, count: pages.length, pages, rejected },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`\nWrote ${pages.length}/${routes.length} ${GROUP} → data/pages/${GROUP}.json`);
  if (rejected.length) {
    console.log(`${rejected.length} rejected:`);
    for (const r of rejected) console.log(`  ${r.path} — ${r.reason}`);
  }
}

main().catch((err) => {
  console.error(`\nHarvest failed: ${err.message}`);
  process.exitCode = 1;
});
