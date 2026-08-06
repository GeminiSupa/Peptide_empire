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
  return lookup;
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
    return { type: 'heading', level, ...bi('text', en, tr) };
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
  ['/', 'home — harvest it explicitly via the homeBlocks group, not as part of core'],
  ['/affiliate-program/', 'one long article — harvest-guides.mjs handles it'],
  ['/info-center/', 'one long article — harvest-guides.mjs handles it'],
  ['/blog/', 'dynamic index (loop-grid) — must be built from our own post data'],
  ['/peptide-guides/', 'dynamic index (loop-grid) — must be built from our own guide data'],
  ['/shop/', 'WooCommerce archive — no Elementor content at all'],
]);

/**
 * The markup to parse: the rendered page for FETCH_RENDERED groups, else REST.
 *
 * Retries with backoff and a per-request timeout. 67 sequential fetches against
 * a live WordPress box will drop at least one connection, and losing the whole
 * run to a single dropped socket is not acceptable.
 */
async function markup(group, route, wp, attempt = 1) {
  if (!FETCH_RENDERED.has(group)) return wp.content.rendered;
  try {
    const res = await fetch(ORIGIN + route.en, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const $ = cheerio.load(await res.text());
    return $('#content').html() ?? '';
  } catch (err) {
    if (attempt >= 4) throw new Error(`${route.en} -> ${err.message} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return markup(group, route, wp, attempt + 1);
  }
}


/**
 * Fold the home page's opening run into a single `hero_split` section.
 *
 * The live hero is two columns — copy on the left, the product photo on the
 * right. That arrangement lives in Elementor's framework stylesheets, not in
 * the page markup or its per-page CSS (verified: the page's own CSS file
 * carries no flex-direction, grid-template-columns or container widths at
 * all). So it cannot be harvested; it has to be declared.
 *
 * This is therefore a deliberate TEMPLATE RULE, not an inference: everything
 * up to and including the first image becomes the hero, with the image as the
 * right-hand column. It is applied only to the home page.
 */
function foldHero(sections) {
  const imageAt = sections.findIndex((s) => s.type === 'image');
  // Guard: only fold a short opening run that actually starts with a heading.
  if (imageAt < 2 || imageAt > 8 || sections[0]?.type !== 'heading') return sections;

  const lead = sections.slice(0, imageAt);
  const image = sections[imageAt];
  return [
    { type: 'hero_split', content: { body: lead, image: image.content } },
    ...sections.slice(imageAt + 1),
  ];
}


/**
 * Fold the "AS SEEN IN" run into a single `press_band` section.
 *
 * On the live page this is a centred divider followed by a container holding
 * two press mentions side by side. Its widgets arrive FLAT and out of visual
 * order — image, text, text, button, text, text, button, image — so the second
 * logo is stranded at the end. Rendered literally that is a column of loose
 * lines with a logo orphaned at the bottom, which is exactly how it looked.
 *
 * Pairs the Nth logo with the Nth outlet and the Nth link, which is the
 * arrangement the live CSS produces.
 */
function foldPress(sections) {
  const start = sections.findIndex((s) => /^as seen in$/i.test(s.content?.text_en ?? ''));
  if (start === -1) return sections;

  // The run ends at the next real heading — the band is self-contained.
  let end = start + 1;
  while (end < sections.length) {
    const s = sections[end];
    if (s.type === 'heading' && (s.content.level ?? 2) >= 1 && s.content.level !== 0) break;
    if (s.type === 'product_grid' || s.type === 'faq') break;
    end += 1;
  }

  const run = sections.slice(start + 1, end);
  const images = run.filter((s) => s.type === 'image');
  const buttons = run.filter((s) => s.type === 'button');
  const paras = run.filter((s) => s.type === 'paragraph');
  if (images.length < 2 || images.length !== buttons.length) return sections;

  const items = images.map((img, i) => ({
    logo: img.content,
    intro_en: paras[i * 2]?.content.text_en ?? '',
    intro_es: paras[i * 2]?.content.text_es ?? '',
    outlet_en: paras[i * 2 + 1]?.content.text_en ?? '',
    outlet_es: paras[i * 2 + 1]?.content.text_es ?? '',
    link: buttons[i].content,
  }));

  return [
    ...sections.slice(0, start),
    {
      type: 'press_band',
      content: {
        title_en: sections[start].content.text_en,
        title_es: sections[start].content.text_es,
        items,
      },
    },
    ...sections.slice(end),
  ];
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
 * Put the harvested reviews back where the page shows them — under the
 * "Customer Success Stories" heading, which is the only thing marking that
 * section in the widget tree. Appended if that heading ever goes away, so the
 * reviews cannot silently vanish again.
 */
function foldReviews(sections, reviews) {
  if (!reviews) return sections;

  // "Customer Success Stories" is the section's real title; "Testimonials" is
  // the small eyebrow ABOVE it. Matching either in one pass hit the eyebrow
  // first and filed the reviews above their own heading, so the title is tried
  // on its own before falling back.
  const find = (re) => sections.findIndex((s) => re.test(s.content?.text_en ?? ''));
  const at = find(/customer success stories/i) !== -1 ? find(/customer success stories/i) : find(/testimonials/i);
  if (at === -1) return [...sections, reviews];

  // After the heading and any intro paragraph that belongs to it.
  let insert = at + 1;
  while (insert < sections.length && sections[insert].type === 'paragraph') insert += 1;

  return [...sections.slice(0, insert), reviews, ...sections.slice(insert)];
}

async function harvestGroup(group, { wpByPath, esByEn, routes, dict }) {
  const out = [];
  let hits = 0;
  let fromDict = 0;
  let misses = 0;
  const noSpanish = [];
  const skipped = [];

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
    const $ = cheerio.load(await markup(group, route, wp));
    const blocks = [];
    for (const el of $('.elementor-widget').toArray()) {
      const block = widgetToBlock($, el, tr);
      if (!block) continue;
      if (Array.isArray(block)) blocks.push(...block);
      else blocks.push(block);
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
      sections: (group === 'homeBlocks'
        ? (x) => foldReviews(foldCategoryTabs(foldPress(foldHero(x))), extractReviews($, tr))
        : (x) => x)(
        blocks.map(({ type, ...rest }) => ({ type, content: rest })),
      ),
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
