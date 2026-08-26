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
import {
  clearLayoutFailures,
  layoutFailures,
  layoutFor,
  layoutFromUrls,
  walkTree,
} from './lib/elementor-tree.mjs';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Groups whose markup is NOT in the REST payload.
 *
 * A WooCommerce product post stores only a short excerpt in content.rendered;
 * the page a visitor sees is assembled by an Elementor *product template* at
 * request time. So for these the rendered page has to be fetched — there is no
 * offline source to parse.
 *
 * The home page is here for a subtler reason. Its content.rendered DOES contain
 * markup, but WordPress expands shortcodes in the REST context, where the
 * WooCommerce and Trustindex widgets resolve differently than on the front end:
 * the product carousels came back holding different products than the live page
 * shows, and the review widget did not render at all. Parsing the page a visitor
 * actually receives is the only way to reproduce what a visitor actually sees.
 */
const FETCH_RENDERED = new Set(['wooProduct', 'homeBlocks']);

/**
 * Named sets of individual pages that do not match their group's usual shape.
 *
 * `guideBlocks` is one page: /retatrutide-complete-guide/ is filed as a guide
 * but is built from ordinary Elementor widgets rather than a single
 * self-contained article, so harvest-guides.mjs finds no article container and
 * rejects it. It belongs on the block path instead. Harvesting the whole
 * `guide` group here would wrongly flatten the other 55.
 */
const EXTRA_GROUPS = {
  guideBlocks: ['/retatrutide-complete-guide/'],
  // The home page. It was originally harvested by a bespoke script into 11
  // hand-authored section components whose layout was invented rather than
  // reproduced, and which captured text only — none of its 45 images and only
  // 12 of its 63 headings. Running it through the same pipeline as the other
  // 316 pages fixes that and retires the bespoke types into the shared
  // vocabulary.
  homeBlocks: ['/'],
};
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
const read = async (p) => JSON.parse(await readFile(resolve(ROOT, p), 'utf8'));

/**
 * Write a group file, retrying briefly if the OS still has it locked.
 *
 * These files are several megabytes, and on Windows something else — a file
 * watcher, an indexer, a virus scanner — routinely holds one open for a moment
 * after it has been read. That surfaces as `UNKNOWN: unknown error, open …`,
 * and it killed two full harvest runs AFTER every page had already been
 * fetched. The lock clears on its own; it just has to be waited out.
 */
async function writeRetrying(file, body, attempt = 1) {
  try {
    await writeFile(file, body, 'utf8');
  } catch (err) {
    if (attempt >= 5) throw err;
    await new Promise((r) => setTimeout(r, 400 * attempt));
    await writeRetrying(file, body, attempt + 1);
  }
}

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
function translator(pairs = [], fallbackDict = null) {
  const byEn = new Map();
  pairs.forEach(([en], i) => {
    if (!byEn.has(en)) byEn.set(en, []);
    byEn.get(en).push(i);
  });

  const consumed = new Set();
  const used = new Map();
  let hits = 0;
  let runHits = 0;
  let dictHits = 0;
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

    // Last resort: the site-wide dictionary reconstructed from every paired
    // page. Used only when this page's own pairs cannot answer — six product
    // pages have no usable pairs because their EN/ES node counts differ.
    // First-wins, so a string with two different translations could resolve to
    // the wrong one; that risk is why it sits below both per-page strategies
    // rather than replacing them, and dictHits is reported separately.
    const fromDict = fallbackDict?.[text];
    if (fromDict) {
      dictHits += 1;
      return { es: fromDict, ok: true };
    }

    misses += 1;
    return { es: text, ok: false };
  };

  lookup.stats = () => ({ hits, runHits, dictHits, misses });

  /**
   * Translate WITHOUT consuming a pair, and without counting a miss.
   *
   * For fragments that are already part of a string this page has translated —
   * the anchor text of a link inside a paragraph. Running those through the
   * normal lookup would consume a pair the paragraph itself needs and report a
   * miss for text that is not actually missing, so this consults only the
   * site-wide dictionary and gives up quietly.
   */
  lookup.peek = (en) => fallbackDict?.[clean(en)] ?? null;

  return lookup;
}

/**
 * The links inside a run of prose.
 *
 * The harvest reduces a paragraph to plain text so it can be matched against
 * its Spanish twin, which drops every `<a>` inside it. On the city pages that
 * was most of the internal linking on the page — /limon/ alone carries 18 links
 * to product landers and neighbouring cities in its body copy, and the clone
 * had five.
 *
 * Stored as anchor text plus href rather than as markup: the renderer finds the
 * anchor text in whichever language it is displaying and wraps it. Spanish
 * resolves through the site-wide dictionary, and any anchor it cannot translate
 * simply renders as text rather than guessing.
 */
/**
 * A widget's icon, in whichever of the two forms this site uses.
 *
 * Font Awesome is inlined by WordPress as an `<svg>` that needs nothing else.
 * ElementsKit is a webfont glyph picked by class (`<i class="icon icon-savings">`),
 * which needs the font — so the class is kept and scripts/mirror-icon-font.mjs
 * mirrors `elementskit.woff` plus the `content:` rules for exactly the glyphs
 * the site actually uses.
 */
function iconOf($, $w) {
  const svg = $w.find('.elementor-icon svg').first();
  if (svg.length) {
    const html = $.html(svg);
    if (html && html.length < 4000) return { icon: html };
  }

  const i = $w.find('.elementor-icon i[class]').first();
  const cls = (i.attr('class') || '')
    .split(/\s+/)
    .filter((c) => /^icon-/.test(c))
    .join(' ');
  return cls ? { iconClass: cls } : {};
}

function inlineLinks($, $node, tr) {
  const links = $node
    .find('a[href]')
    .toArray()
    .map((a) => {
      const text = clean($(a).text());
      const href = rel($(a).attr('href'));
      if (!text || !href) return null;
      return { text_en: text, text_es: tr.peek(text) ?? text, href };
    })
    .filter(Boolean);
  return links.length ? links : undefined;
}

/** `{ x_en, x_es }` from one English string. */
const bi = (key, en, tr) => ({ [`${key}_en`]: en, [`${key}_es`]: en ? tr(en).es : '' });

/**
 * Widgets that must never become a block.
 *
 * The add-to-cart widget is the important one: this project sells nothing, and
 * emitting it would put a dead quantity/cart control on every product page.
 * Buying happens on the catalog site. Ratings and testimonials are live,
 * changing data that does not belong in a static harvest.
 */
const IGNORED = new Set([
  'woocommerce-product-add-to-cart',
  'rating',
  'woocommerce-product-meta',
  'video', // Elementor builds the player client-side; content.rendered is empty
]);

/**
 * The real image URL, not a lazy-loading placeholder.
 *
 * Pages parsed from the REST payload are unaffected, but the product pages are
 * fetched RENDERED, where lazy loading has already swapped `src` for an inline
 * transparent SVG data URI and moved the real file into a data-* attribute.
 * Taking `src` blindly harvested 48 placeholders as if they were images.
 */
function realSrc($, img) {
  const src = img.attr('src');
  if (src && !src.startsWith('data:')) return src;

  // data-breeze first: on RENDERED pages the Breeze cache plugin is what swaps
  // src for a placeholder, and for plain image widgets it is the only attribute
  // holding the real URL — there is no srcset to fall back to. The REST payload
  // is not lazy-loaded, so this gap only appeared once the home page began
  // harvesting from the rendered page, where it silently dropped the
  // before/after photos.
  for (const attr of ['data-breeze', 'data-src', 'data-lazy-src', 'data-original', 'data-large_image']) {
    const v = img.attr(attr);
    if (v && !v.startsWith('data:')) return v;
  }

  // Fall back to the widest candidate in a srcset.
  // data-brsrcset is the Breeze cache plugin's own lazy-load attribute; it is
  // the ONLY place the real URL survives on the product pages.
  for (const attr of ['srcset', 'data-srcset', 'data-brsrcset']) {
    const set = img.attr(attr);
    if (!set) continue;
    const best = set
      .split(',')
      .map((part) => part.trim().split(/\s+/))
      .filter(([url]) => url && !url.startsWith('data:'))
      .sort((a, b) => (parseInt(b[1] ?? '0', 10) || 0) - (parseInt(a[1] ?? '0', 10) || 0))[0];
    if (best) return best[0];
  }
  return null;
}

/**
 * Convert a plain Gutenberg / classic-editor body into the same block
 * vocabulary the Elementor path produces.
 *
 * Used only when a page has no Elementor widgets at all. It walks the stored
 * post content top to bottom and emits the same `heading` / `paragraph` /
 * `list` shapes, so these pages render through the identical pipeline as every
 * other page rather than needing a renderer of their own.
 */
function gutenbergBlocks($, tr) {
  const blocks = [];
  const seen = new Set();

  $('h1, h2, h3, h4, h5, h6, p, ul, ol').each((_, node) => {
    // Skip anything nested inside a list we have already taken whole.
    if ($(node).parents('ul, ol').length > 0) return;

    const tag = node.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = clean($(node).text());
      if (!text || seen.has(`h:${text}`)) return;
      seen.add(`h:${text}`);
      blocks.push({ type: 'heading', level: Number(tag[1]), ...bi('text', text, tr) });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = $(node)
        .children('li')
        .toArray()
        .map((li) => clean($(li).text()))
        .filter(Boolean);
      if (!items.length) return;
      blocks.push({
        type: 'list',
        ordered: tag === 'ol',
        items_en: items,
        items_es: items.map((i) => tr(i).es),
      });
      return;
    }

    const text = clean($(node).text());
    if (!text || seen.has(`p:${text}`)) return;
    seen.add(`p:${text}`);
    blocks.push({ type: 'paragraph', ...bi('text', text, tr) });
  });

  return blocks;
}

function widgetToBlock($, el, tr) {
  const $w = $(el);
  const type = ($w.attr('data-widget_type') ?? '').split('.')[0];
  if (IGNORED.has(type)) return null;
  const container = $w.find('.elementor-widget-container').first();

  if (type === 'heading') {
    // Elementor lets a heading widget render as any tag, and 113 headings across
    // the corpus use <p> or <div>. Looking only for h1-h6 dropped their text
    // entirely — silently, because the widget simply yielded no block.
    //
    // level 0 means "looks like a heading, is not one semantically", which is
    // what the live DOM does. The renderer styles it as a heading but emits a
    // <p>, so both the appearance and the markup match the page being cloned.
    const el = $w.find('h1,h2,h3,h4,h5,h6,.elementor-heading-title').first();
    const en = clean(el.text());
    if (!en) return null;
    const tag = el[0]?.tagName ?? '';
    const level = /^h[1-6]$/i.test(tag) ? Number(tag[1]) : 0;
    return { type: 'heading', level, ...bi('text', en, tr), links: inlineLinks($, el, tr) };
  }

  if (type === 'text-editor') {
    // All six heading levels, not just h4/h5. A text-editor widget can hold a
    // whole document: the returns policy keeps its eight <h2> section titles
    // in one, and they were dropped entirely because h2 was not selected here.
    const kids = container.children('p,ul,ol,h1,h2,h3,h4,h5,h6,table').toArray();
    const nodes = kids.length ? kids : [container[0]];
    const out = [];
    for (const node of nodes) {
      if (!node) continue;
      const $n = $(node);

      if (node.tagName === 'table') {
        // Tables were previously flattened into a run-on paragraph.
        //
        // Cells keep their LINK as well as their text. /our-service-locations/
        // is a table of 145 city names where every name is a link to that
        // city's page; reading the cells with .text() alone reproduced the
        // words and silently dropped every link, leaving the site's main
        // directory of city pages navigable only through the sitemap.
        const cells = $n
          .find('tr')
          .toArray()
          .map((tr_) =>
            $(tr_)
              .find('th,td')
              .toArray()
              .map((c) => {
                const $c = $(c);
                const text = clean($c.text());
                const a = $c.find('a[href]').first();
                // Only when the link IS the cell — a link buried inside a
                // sentence belongs to the prose, not to the cell.
                const href =
                  a.length && clean(a.text()) === text && text ? rel(a.attr('href')) : null;
                return { text, href };
              }),
          )
          .filter((r) => r.some((c) => c.text));
        if (!cells.length) continue;
        const hasHead = $n.find('thead th,thead td').length > 0;
        const header = hasHead ? cells[0].map((c) => c.text) : null;
        const bodyCells = hasHead ? cells.slice(1) : cells;
        const body = bodyCells.map((r) => r.map((c) => c.text));
        const links = bodyCells.map((r) => r.map((c) => c.href));
        out.push({
          type: 'table',
          header_en: header,
          header_es: header ? header.map((c) => tr(c).es) : null,
          rows_en: body,
          rows_es: body.map((r) => r.map((c) => tr(c).es)),
          // Omitted entirely when the table has no links, so the common case
          // stays exactly as it was.
          ...(links.some((r) => r.some(Boolean)) ? { links } : {}),
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

      // A heading inside a text-editor is still a heading. Emitting it as a
      // paragraph flattened the page's outline — the returns policy rendered
      // as 45 undifferentiated paragraphs instead of eight titled sections.
      if (/^h[1-6]$/.test(node.tagName)) {
        const en = clean($n.text());
        if (en) {
          out.push({
            type: 'heading',
            level: Number(node.tagName[1]),
            ...bi('text', en, tr),
            links: inlineLinks($, $n, tr),
          });
        }
        continue;
      }

      const en = clean($n.text());
      if (en) out.push({ type: 'paragraph', ...bi('text', en, tr), links: inlineLinks($, $n, tr) });
    }
    return out.length ? out : null;
  }

  if (type === 'icon-list') {
    const items = $w
      .find('.elementor-icon-list-item')
      .toArray()
      .map((el) => {
        const $i = $(el);
        const text = clean($i.find('.elementor-icon-list-text').text() || $i.text());
        if (!text) return null;
        return { text, href: rel($i.find('a').first().attr('href')) };
      })
      .filter(Boolean);
    if (!items.length) return null;

    const li = items.map((i) => i.text);
    return {
      type: 'list',
      icon: true,
      // `elementor-inline-items` is how Elementor marks a HORIZONTAL icon list.
      // It is in the markup, so it needs no stylesheet lookup — and without it
      // the hero's three inline assurances stacked into a vertical column.
      inline: $w.find('.elementor-icon-list-items').hasClass('elementor-inline-items'),
      items_en: li,
      items_es: li.map((t) => tr(t).es),
      hrefs: items.map((i) => i.href),
    };
  }

  if (type === 'button') {
    const a = $w.find('a').first();
    const en = clean(a.text());
    if (!en) return null;
    return { type: 'button', ...bi('text', en, tr), href: rel(a.attr('href')) };
  }

  if (type === 'image') {
    const img = $w.find('img').first();
    if (!img.length) return null;
    const src = realSrc($, img);
    if (!src) return null;
    // WordPress emits the file's natural size. Without it every image rendered
    // at one blanket max-width, so a 300x112 press logo was blown up to 672px.
    const w = Number(img.attr('width')) || null;
    const h = Number(img.attr('height')) || null;
    return { type: 'image', src: rel(src), width: w, height: h, ...bi('alt', clean(img.attr('alt')), tr) };
  }

  if (type === 'icon-box') {
    const title = clean($w.find('.elementor-icon-box-title').text());
    const text = clean($w.find('.elementor-icon-box-description').text());
    if (!title && !text) return null;

    return {
      type: 'card',
      ...bi('title', title, tr),
      ...bi('text', text, tr),
      ...iconOf($, $w),
      href: rel($w.find('a').first().attr('href')),
    };
  }

  // A standalone icon widget. These sit above each card in "What We Offer" as
  // their own sibling widget rather than inside an icon-box, so they were not
  // covered by the branch above and were dropped entirely.
  if (type === 'icon') {
    const icon = iconOf($, $w);
    return icon.icon || icon.iconClass ? { type: 'icon', ...icon } : null;
  }

  if (type === 'divider') {
    const en = clean($w.find('.elementor-divider__text').text());

    // A divider carrying text is how this site draws its section titles:
    // "Popular Products" followed by a rule running to the edge of the column.
    // It stays a heading — the text really is the section's title and the page
    // outline should say so — and `rule` restores the line beside it.
    if (en) return { type: 'heading', level: 2, rule: true, ...bi('text', en, tr) };

    // A divider with no text is the decorative rule itself. Dropping it lost
    // the two lines flanking "AS SEEN IN", leaving the label floating alone.
    return { type: 'divider' };
  }

  // Elementor's nested tabs: titles and panes are siblings in document order.
  if (type === 'nested-tabs') {
    const titles = $w.find('.e-n-tab-title').toArray();
    const panes = $w.find('.e-n-tabs-content > .e-con').toArray();
    const items = [];
    for (let i = 0; i < titles.length; i += 1) {
      const label = clean($(titles[i]).text());
      if (!label) continue;

      // Pull the pane's PRODUCTS, not its text. On the home page these panes
      // are WooCommerce grids, so flattening one to a string produced
      // "HGH 12 IU ₡31,794 Add to cart Mots-C 10mg…" — a run-on duplicate of the
      // cards below it, carrying the cart labels this site must never show.
      const products = [];
      $(panes[i])
        .find('li.product')
        .each((_, li) => {
          const $p = $(li);
          const name = clean($p.find('.woocommerce-loop-product__title').text());
          if (!name) return;
          products.push({
            name,
            price: clean($p.find('.price').text()),
            href: rel($p.find('a').first().attr('href')),
            image: rel(realSrc($, $p.find('img').first())),
          });
        });

      items.push(
        products.length
          ? { ...bi('label', label, tr), products }
          : { ...bi('label', label, tr), ...bi('body', clean($(panes[i]).text()), tr) },
      );
    }
    if (!items.length) return null;

    // Panes carrying products are the "Shop By Category" strip; panes carrying
    // prose are an ordinary tab widget. The walk never descends into a widget,
    // so this pairing has to happen here rather than in a later fold — the
    // grids are inside the tab widget, not siblings of it.
    return items.every((i) => i.products) ? { type: 'category_tabs', items } : { type: 'tabs', items };
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

  // Static marketing copy in a slider. Previously lumped in with `rating` as
  // "live, changing data" and dropped, which cost four real quotes on every
  // product page.
  if (type === 'elementskit-testimonial') {
    const items = [];
    $w.find('.swiper-slide').each((_, slide) => {
      const $s = $(slide);
      const quote = clean($s.find('.elementskit-commentor-content p, .elementskit-commentor-content').first().text());
      const name = clean($s.find('.elementskit-author-name, .elementskit-commentor-details .elementskit-author-name').first().text());
      const role = clean($s.find('.elementskit-author-des').first().text());
      if (!quote) return;
      items.push({ ...bi('quote', quote, tr), ...bi('name', name, tr), ...bi('role', role, tr) });
    });
    return items.length ? { type: 'testimonials_slider', items } : null;
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
        // realSrc, not attr('src') — related-product thumbnails are lazy-loaded
        // on the rendered product pages exactly like the main images are.
        image: rel(realSrc($, $p.find('img').first())),
      });
    });
    if (products.length) return { type: 'product_grid', products };

    // The Trustindex review widget. Its markup does not follow Elementor's
    // structure — a review item has no `.elementor-widget` ancestor — so it is
    // extracted whole by extractReviews rather than parsed here. This leaves a
    // marker at the point in the tree where the reviews belong, and
    // fillReviewSlot swaps the real block in. Without it the reviews were
    // appended after the last section instead of sitting inside the navy
    // testimonials band that introduces them.
    if ($w.find('.ti-widget').length) return { type: 'reviews_slot' };

    return null;
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
  ['/', 'home — harvest it explicitly via the homeBlocks group, not as part of core'],
  ['/affiliate-program/', 'one long article — harvest-guides.mjs handles it'],
  ['/info-center/', 'one long article — harvest-guides.mjs handles it'],
  ['/blog/', 'dynamic index (loop-grid) — must be built from our own post data'],
  ['/peptide-guides/', 'dynamic index (loop-grid) — must be built from our own guide data'],
  ['/shop/', 'WooCommerce archive — no Elementor content at all'],
  // Generated by scripts/build-html-sitemap.mjs from our own route inventory.
  // WordPress renders it from a plugin and stores NO content for it, so
  // harvesting produced a page with zero sections that overwrote the generated
  // one — silently deleting the site's full index on any re-harvest of `legal`.
  ['/html-sitemap/', 'generated by build-html-sitemap.mjs — harvesting it yields a blank page'],
]);

/**
 * The markup to parse: the rendered page for FETCH_RENDERED groups, else REST.
 *
 * Retries with backoff and a per-request timeout. 67 sequential fetches against
 * a live WordPress box will drop at least one connection, and losing the whole
 * run to a single dropped socket is not acceptable.
 */
async function markup(group, route, wp, attempt = 1) {
  if (!FETCH_RENDERED.has(group)) return { html: wp.content.rendered, cssUrls: null };
  try {
    const res = await fetch(ORIGIN + route.en, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);

    // A 404 means the page is gone from the live site, which is an answer, not
    // a failure to get one — retrying cannot change it. Returning null lets the
    // caller drop that one page and report it, instead of one withdrawn product
    // aborting the run and leaving the other 66 on their previous harvest.
    if (res.status === 404 || res.status === 410) return null;

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    const $ = cheerio.load(body);

    // The stylesheets the page itself asks for. A product page carries no CSS
    // of its own — its layout is declared against the Elementor product
    // TEMPLATE's post id — so the only reliable way to find it is to read the
    // links, exactly as a browser would.
    const cssUrls = [
      ...new Set(
        [...body.matchAll(/href=["']([^"']*\/elementor\/css\/post-\d+[^"']*)["']/g)].map((m) =>
          m[1].replace(/&amp;/g, '&'),
        ),
      ),
    ];

    return { html: $('#content').html() ?? '', cssUrls };
  } catch (err) {
    if (attempt >= 4) throw new Error(`${route.en} -> ${err.message} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return markup(group, route, wp, attempt + 1);
  }
}


/**
 * Wrap the walker's `{ type, ...rest }` blocks into the stored
 * `{ type, content }` shape, all the way down a group's children.
 */
function normalise(blocks) {
  return blocks.map(({ type, children, ...rest }) => ({
    type,
    content: children ? { ...rest, children: normalise(children) } : rest,
  }));
}

/**
 * Run the sibling-level folds at EVERY level of the container tree.
 *
 * The folds pair widgets that Elementor emits as flat siblings. Now that the
 * harvest keeps the container tree, those siblings are no longer all at the top
 * level — the tab strip and its grids sit inside whichever container holds
 * them — so folding only the outermost array would silently miss them.
 */
function foldTree(sections) {
  const folded = sections.map((s) =>
    s.content?.children
      ? { ...s, content: { ...s.content, children: foldTree(s.content.children) } }
      : s,
  );
  return foldCategoryTabs(folded);
}

/**
 * Fold the "Shop By Category" tab strip and the product grids that follow it
 * into a single `category_tabs` section.
 *
 * Elementor emits the tab titles as one widget and each panel's product grid as
 * a separate sibling, so the harvest is a `tabs` block followed by eight
 * `product_grid` blocks — flat, with nothing saying which grid belongs to which
 * tab. Rendered literally that became one continuous 27-product wall, because
 * the renderer merges consecutive grids; on the live site only the active tab's
 * four products are visible.
 *
 * The Nth grid is the Nth tab's panel, which is the order Elementor emits and
 * the order its own JavaScript reads back. Folding only when the counts match
 * means an edited tab strip falls back to the flat blocks rather than silently
 * pairing a grid with the wrong category.
 */
function foldCategoryTabs(sections) {
  const at = sections.findIndex((s) => s.type === 'tabs');
  if (at === -1) return sections;

  const tabs = sections[at].content.items ?? [];
  const grids = [];
  let end = at + 1;
  while (end < sections.length && sections[end].type === 'product_grid') {
    grids.push(sections[end]);
    end += 1;
  }
  if (!tabs.length || grids.length !== tabs.length) return sections;

  // The tab's `body` is dropped, not kept. The generic nested-tabs handler
  // flattens a whole pane to text, and these panes ARE the product grid — so the
  // body is "HGH 12 IU ₡31,794 Add to cart Mots-C 10mg…", a run-on duplicate of
  // the cards rendered right below it, complete with the cart labels this site
  // must never show. The structured products are the real content.
  const items = tabs.map((tab, i) => {
    const { body_en: _en, body_es: _es, ...rest } = tab;
    return { ...rest, products: grids[i].content.products };
  });

  return [
    ...sections.slice(0, at),
    { type: 'category_tabs', content: { items } },
    ...sections.slice(end),
  ];
}

/**
 * The Trustindex review widget, pulled straight from the page DOM.
 *
 * This is NOT a widget-tree extraction, and cannot be. The plugin renders its
 * markup outside Elementor's structure entirely — a review item has no
 * `.elementor-widget` ancestor at all — so the widget loop that produces every
 * other block on this page structurally cannot reach it. That is why six real
 * customer reviews were missing from the clone rather than merely mis-rendered.
 *
 * The reviews are a snapshot, in the same way prices are: Trustindex refreshes
 * them from the platform, so the profile linked in the footer stays the
 * authority for what the current rating is.
 *
 * Deliberately NOT translated. Machine-translating a customer's review would
 * put words in their mouth, and the live site leaves each one in the language
 * it was written in — so there is no `_es` variant of the review text.
 */
function extractReviews($, tr) {
  const widget = $('.ti-widget')
    .toArray()
    .find((el) => $(el).find('.ti-review-item').length);
  if (!widget) return null;

  const $widget = $(widget);
  const reviews = $widget
    .find('.ti-review-item')
    .toArray()
    .map((item) => {
      const $i = $(item);
      const author = clean($i.find('.ti-name').first().text());
      // The tooltip inside .ti-stars is boilerplate about the review's
      // provenance, not part of what the customer wrote.
      const text = clean($i.find('.ti-review-text-container, .ti-review-content').first().text());
      if (!author && !text) return null;
      return {
        author,
        text,
        source: ($i.attr('class') || '').match(/source-([\w-]+)/)?.[1] ?? null,
        stars: $i.find('.ti-stars [alt*="star" i]').length || null,
      };
    })
    .filter(Boolean);

  if (!reviews.length) return null;

  const summary = clean($widget.find('.ti-widget-header, .ti-header').first().text());
  return {
    type: 'reviews',
    content: { ...bi('summary', summary, tr), reviews },
  };
}

/**
 * Put the harvested reviews where the page actually shows them.
 *
 * The Trustindex widget renders client-side and OUTSIDE Elementor's tree, so
 * the container walk finds only an empty shortcode widget where the reviews
 * belong. widgetToBlock leaves a `reviews_slot` there; this swaps the real
 * block in, keeping them inside the navy testimonials band rather than
 * stranded at the end of the page.
 */
/**
 * A section title drawn with a divider is a heading — unless the page already
 * has that heading.
 *
 * The divider widget carrying text is how this site draws "Popular Products"
 * and "Latest Product", and those really are section titles, so they become
 * headings. But the category pages draw their OWN page title that way a second
 * time, below the h1: /peptides-for-weight-loss/ ended up with a styled h1 and
 * a bare h2 saying the same words, where the live page has one h1 and a divider.
 *
 * Elementor renders divider text as `.elementor-divider__text`, never as a
 * heading, so dropping the semantics on the duplicate is what matches the
 * original. The rule beside it is kept either way.
 */
function demoteDuplicateRules(sections) {
  const seen = new Map();
  const visit = (node, pass) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, pass));
    if (node.type === 'heading' && node.content) {
      const text = (node.content.text_en ?? '').trim().toLowerCase();
      if (text) {
        if (pass === 'count') seen.set(text, (seen.get(text) ?? 0) + 1);
        else if (node.content.rule && seen.get(text) > 1) node.content.semantic = false;
      }
    }
    const kids = node.content?.children;
    if (Array.isArray(kids)) kids.forEach((k) => visit(k, pass));
  };
  visit(sections, 'count');
  visit(sections, 'mark');
  return sections;
}

function fillReviewSlot(sections, reviews) {
  let placed = false;

  const swap = (list) =>
    list.flatMap((s) => {
      if (s.type === 'reviews_slot') {
        if (!reviews || placed) return [];
        placed = true;
        return [reviews];
      }
      if (s.content?.children) {
        return [{ ...s, content: { ...s.content, children: swap(s.content.children) } }];
      }
      return [s];
    });

  const out = swap(sections);
  // Appended rather than dropped if the slot ever disappears, so six real
  // customer reviews cannot silently vanish from the page again.
  return reviews && !placed ? [...out, reviews] : out;
}

async function harvestGroup(group, { wpByPath, esByEn, routes, dict }) {
  const out = [];
  let hits = 0;
  let fromDict = 0;
  let misses = 0;
  const noSpanish = [];
  const skipped = [];
  /** Pages the live site no longer serves. Reported, never silently dropped. */
  const gone = [];
  clearLayoutFailures();
  /** Pages whose fetch failed for reasons that are not the page's fault. */
  const failed = [];

  /**
   * The previous harvest of this group, for carry-forward.
   *
   * A dropped connection is a fact about the network, not about the page. Losing
   * the run to one flaky fetch is bad; quietly writing the group WITHOUT that
   * page is worse, because it deletes a live page from the site. So a transient
   * failure keeps the previous harvest of that page and says so.
   */
  const previous = new Map();
  try {
    const old = await read(`data/pages/${group}.json`);
    for (const page of old.pages ?? []) previous.set(page.en, page);
  } catch {
    // First run for this group; nothing to carry forward.
  }

  const wanted = EXTRA_GROUPS[group]
    ? routes.filter((r) => EXTRA_GROUPS[group].includes(r.en))
    : routes.filter((r) => r.group === group);

  for (const route of wanted) {
    // An explicit EXTRA_GROUPS include wins over SKIP: naming a path is a
    // deliberate instruction to harvest it, not something to silently ignore.
    if (!EXTRA_GROUPS[group] && SKIP.has(route.en)) {
      skipped.push([route.en, SKIP.get(route.en)]);
      continue;
    }
    const wp = wpByPath.get(route.en);
    if (!wp) continue;
    const es = esByEn.get(route.en);
    if (!es) noSpanish.push(route.en);

    const tr = translator(es?.pairs, dict);

    let fetched;
    try {
      fetched = await markup(group, route, wp);
    } catch (err) {
      const carried = previous.get(route.en);
      if (!carried) throw err;
      failed.push([route.en, err.message]);
      out.push(carried);
      continue;
    }
    if (fetched === null) {
      gone.push(route.en);
      continue;
    }
    const $ = cheerio.load(fetched.html);

    // Walk the CONTAINER tree, not a flat sweep of widgets. The layout map is
    // this page's own Elementor stylesheet, which is where every column width,
    // section background and card is declared — see scripts/lib/elementor-*.
    const css = fetched.cssUrls?.length
      ? await layoutFromUrls(fetched.cssUrls)
      : await layoutFor(wp.id, route.en);
    const root = $('[data-elementor-type]').first();
    const blocks = walkTree($, root.length ? root : $.root(), tr, css, widgetToBlock);

    // Not every page is built with Elementor. The policy pages are plain
    // Gutenberg, so there is no `.elementor-widget` anywhere in them and the
    // loop above yields nothing — which shipped /shipping-policy/ as a blank
    // page in both languages. Fall back to walking the stored post content.
    if (blocks.length === 0) {
      blocks.push(...gutenbergBlocks(cheerio.load(wp.content.rendered), tr));
    }

    const stats = tr.stats();
    hits += stats.hits + stats.runHits;
    fromDict += stats.dictHits;
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
      // The converged section vocabulary — see scripts/migrate-shape.mjs.
      //
      // foldHero and foldPress are gone: both existed only to rebuild a
      // two-column arrangement the flat sweep had destroyed, and the container
      // walk now carries the real one. foldCategoryTabs still earns its place —
      // Elementor emits the tab strip and each panel's grid as siblings, with
      // nothing in the markup saying which grid belongs to which tab.
      // Reviews are filled in for EVERY group, not just the home page. The
      // about page carries the same Trustindex widget and showed six customer
      // reviews on the live site against none here, because this ran only for
      // homeBlocks. On a page that has no review widget both halves are no-ops:
      // extractReviews returns null and fillReviewSlot drops the empty marker.
      sections: demoteDuplicateRules(
        fillReviewSlot(foldTree(normalise(blocks)), extractReviews($, tr)),
      ),
      untranslated: stats.misses,
    });
  }

  /**
   * Refuse to replace a good harvest with a layout-less one.
   *
   * Page CONTENT comes from the stored REST snapshot, but LAYOUT is fetched
   * live, one stylesheet per page. So if the site is unreachable — rate
   * limiting, an outage, no network — every page still harvests perfectly well
   * and simply comes out as one flat column, which is exactly the defect this
   * whole pipeline exists to fix. Writing that over a good file would undo the
   * work silently and look like success.
   *
   * The check is a comparison against what is already on disk rather than a
   * fixed threshold, so a group that legitimately has no rows is not blocked.
   */
  const countLayout = (pages) => {
    let signals = 0;
    const walk = (s) => {
      if (s.type !== 'group') return;
      const c = s.content;
      // Every property that only a stylesheet can supply. Counting rows alone
      // missed a group whose sole piece of layout was a background colour.
      if (c.dir === 'row' || c.width || c.bg || c.bgImage || c.radius || c.border) signals += 1;
      c.children.forEach(walk);
    };
    for (const p of pages) p.sections.forEach(walk);
    return signals;
  };

  const file = resolve(ROOT, `data/pages/${group}.json`);
  const layoutNow = countLayout(out);
  const layoutBefore = countLayout([...previous.values()]);

  if (layoutFailures.length && layoutNow < layoutBefore) {
    throw new Error(
      `${group}: ${layoutFailures.length} stylesheet(s) failed to fetch and layout was lost ` +
        `(${layoutNow} styled containers, was ${layoutBefore}). ` +
        `Refusing to overwrite data/pages/${group}.json. ` +
        `Check the live site is reachable, then re-run.`,
    );
  }

  await mkdir(dirname(file), { recursive: true });
  await writeRetrying(
    file,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group, count: out.length, pages: out },
      null,
      2,
    )}\n`,
  );

  const blocks = out.reduce((n, p) => n + p.sections.length, 0);
  const kinds = {};
  for (const p of out) for (const b of p.sections) kinds[b.type] = (kinds[b.type] ?? 0) + 1;

  console.log(`\n${group}: ${out.length} pages · ${blocks} blocks → data/pages/${group}.json`);
  console.log(
    `  Spanish: ${hits} matched` +
      (fromDict ? `, ${fromDict} via the site-wide dictionary` : '') +
      `, ${misses} fell back to English`,
  );
  console.log(
    `  blocks: ${Object.entries(kinds)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ')}`,
  );
  if (noSpanish.length) console.log(`  ${noSpanish.length} pages had no Spanish pairs`);
  if (failed.length) {
    console.log(`  ${failed.length} pages FAILED to fetch — kept their previous harvest:`);
    for (const [path, why] of failed) console.log(`    ${path} — ${why}`);
    console.log('    re-run this group to pick them up.');
  }
  if (layoutFailures.length) {
    console.log(`  ${layoutFailures.length} stylesheet(s) could not be fetched — those pages lost their LAYOUT:`);
    for (const f of layoutFailures) console.log(`    ${f}`);
    console.log('    re-run this group; a page with no stylesheet renders as one flat column.');
  }
  if (gone.length) {
    console.log(`  ${gone.length} GONE from the live site (404) — not harvested:`);
    for (const path of gone) console.log(`    ${path}`);
  }
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

  // Products are a separate REST collection from pages, but they route and
  // render the same way, so both feed one path -> post lookup.
  const [wpPages, wpProducts, esData, routeData] = await Promise.all([
    read('data/wp/pages.json'),
    read('data/wp/product.json'),
    read('data/wp-es/pages.json'),
    read('data/routes.json'),
  ]);

  let dict = null;
  try {
    dict = (await read('data/translations.json')).entries;
  } catch {
    // Optional. Without it the per-page pairs still do all the real work.
  }

  const ctx = {
    wpByPath: new Map([...wpPages, ...wpProducts].map((p) => [new URL(p.link).pathname, p])),
    esByEn: new Map(esData.pages.map((p) => [p.en, p])),
    routes: routeData.routes,
    dict,
  };

  for (const group of groups) await harvestGroup(group, ctx);
}

main().catch((err) => {
  console.error(`\nharvest-blocks failed: ${err.message}`);
  process.exit(1);
});
