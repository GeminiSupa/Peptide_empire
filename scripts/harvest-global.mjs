/**
 * Harvest the site-wide chrome — announcement bar, header nav, footer — from the
 * live site, in BOTH languages, into data/global.json.
 *
 * Why harvest instead of hand-writing: the Spanish here is human-reviewed
 * TranslatePress output on a live site. Anything typed by hand is a guess, and
 * a wrong nav label is a wrong label on all 322 pages.
 *
 * Pairing method: the English and Spanish pages render the same Elementor
 * widgets in the same order, so list item N in one is the twin of item N in the
 * other. Every extraction below asserts the two sides have equal length and
 * fails the run if they don't, so a template change surfaces as a build error
 * rather than as silently mismatched translations.
 *
 * Usage: node scripts/harvest-global.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/global.json');

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const rel = (h) => {
  const v = (h || '').trim();
  if (!v) return null;
  return v.startsWith(ORIGIN) ? v.slice(ORIGIN.length) || '/' : v;
};

/**
 * The real URL behind a lazy-loaded <img>.
 *
 * The Breeze cache plugin replaces `src` with an inline SVG placeholder and
 * parks the true URL on `data-breeze`, so reading `src` yields a 1x1 data URI.
 * Mirrors realSrc() in scripts/harvest-blocks.mjs.
 */
function realSrc($, img) {
  if (!img?.length) return null;
  for (const attr of ['data-breeze', 'data-lazy-src', 'src']) {
    const v = (img.attr(attr) || '').trim();
    if (v && !v.startsWith('data:')) return v;
  }
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
 * Fetch and parse a page, retrying with backoff.
 *
 * The live WordPress box intermittently 500s — /es/ did exactly that mid-run and
 * took the whole harvest down with it, on a request that succeeded on the next
 * attempt seconds later. Everything here is all-or-nothing (the run rewrites the
 * chrome for all 322 pages), so a transient blip must not be fatal.
 */
async function load(path, attempt = 1) {
  try {
    const res = await fetch(ORIGIN + path, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return cheerio.load(await res.text());
  } catch (err) {
    if (attempt >= 4) throw new Error(`${path} → ${err.message}`);
    console.log(`  ${path} → ${err.message}; retrying (${attempt}/3)`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return load(path, attempt + 1);
  }
}

/** Assert two harvested lists line up before they get paired by index. */
function pairLists(enList, esList, what) {
  if (enList.length !== esList.length) {
    throw new Error(
      `${what}: EN has ${enList.length} entries, ES has ${esList.length}. ` +
        `Positional pairing would produce wrong translations — aborting.`
    );
  }
  return enList.map((en, i) => [en, esList[i]]);
}

/**
 * Header menu. Top-level items live in `nav ul > li`. A normal dropdown puts
 * its children in a `<ul>`; the two mega menus (SHOP BY PRODUCT, SHOP BY
 * CATEGORY) use an ElementsKit `<div>` panel instead, so both are handled.
 */
function readNav($) {
  const $ul = $('nav ul').first();
  return $ul
    .children('li')
    .toArray()
    .map((li) => {
      const $li = $(li);
      const $a = $li.children('a').first();
      // First text node only — the mega-menu markup appends hidden labels.
      const own = $a
        .contents()
        .filter((_, n) => n.type === 'text')
        .first()
        .text();
      const $panel = $li.children('ul, div').first();
      const children = $panel.length
        ? $panel
            .find('a')
            .toArray()
            .map((a) => ({ label: clean($(a).text()), href: rel($(a).attr('href')) }))
            .filter((c) => c.label && c.href)
        : [];
      return {
        label: clean(own) || clean($a.text()),
        href: rel($a.attr('href')),
        children,
      };
    });
}

/** Every `.elementor-widget-container` in the footer, in document order. */
function footerBlocks($) {
  return $('.ekit-template-content-footer .elementor-widget-container')
    .toArray()
    .map((el) => {
      const $el = $(el);
      const heading = clean($el.find('.elementor-heading-title').first().text());
      const links = $el
        .find('a')
        .toArray()
        .map((a) => ({ label: clean($(a).text()), href: rel($(a).attr('href')) }))
        .filter((l) => l.href);
      return { heading, links, text: links.length ? '' : clean($el.text()) };
    })
    .filter((b) => b.heading || b.links.length || b.text);
}

/**
 * The review band below the footer columns: Trustpilot, Google and Facebook,
 * each a logo, a name, a score and a star rating, linked to that profile.
 *
 * This lives in the FOOTER template, which is why the page harvester never saw
 * it — scripts/harvest-blocks.mjs walks page content, and the band is chrome. It
 * was missing from all 322 pages, not just the home page.
 *
 * The scores are typed into Elementor by hand, so they are static content and
 * safe to mirror. They are still a snapshot of what the live site claims today,
 * exactly like the product prices — the linked profile is the authority.
 */
function reviewBand($) {
  return $('.ekit-template-content-footer')
    .find('a')
    .toArray()
    .map((el) => {
      const $a = $(el);
      if (!$a.find('.e-rating').length) return null;

      // Two headings inside the card: the platform name, then the score. Taking
      // them by position rather than by pattern keeps a renamed platform working.
      const headings = $a
        .find('.elementor-heading-title')
        .toArray()
        .map((h) => clean($(h).text()))
        .filter(Boolean);
      const name = headings[0];
      if (!name) return null;

      // Two values, deliberately. The heading is the DISPLAY copy — the live
      // site writes "5.0" where the microdata says "5" — and the meta is the
      // precise number the star widget fills to. Showing the meta printed "5"
      // under a logo where the original reads "5.0".
      const score = headings[1] || clean($a.find('[itemprop="ratingValue"]').first().attr('content'));
      const value = clean($a.find('[itemprop="ratingValue"]').first().attr('content')) || score;
      const best = clean($a.find('[itemprop="bestRating"]').first().attr('content')) || '5';
      const img = $a.find('img').first();

      return {
        name,
        score,
        value,
        best,
        href: $a.attr('href') || null,
        logo: rel(realSrc($, img)),
        logoAlt: clean(img.attr('alt')),
      };
    })
    .filter(Boolean);
}

/**
 * The display name for a social profile link.
 *
 * Seven of the eight footer links are icon fonts whose anchor text is already
 * the platform name, so the harvested label is used as-is and the live wording
 * ("X-twitter") is preserved. The Bluesky link is an inline SVG instead, and its
 * anchor text is the image's alt attribute — which shipped a footer link
 * labelled "Butterfly Outline Vector Art." on all 322 pages.
 *
 * So: keep the label when it actually names the destination, otherwise fall back
 * to the domain. The check is whether the label and the hostname share any text,
 * which no alt-text description will.
 */
const PLATFORMS = { 'bsky.app': 'Bluesky', 'x.com': 'X-twitter', 'youtu.be': 'Youtube' };

function socialName(label, href) {
  const host = new URL(href).hostname.replace(/^www\./, '');
  const site = host.split('.')[0];
  const flat = (label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (flat && (host.replace(/[^a-z0-9]/g, '').includes(flat) || flat.includes(site))) return label;

  return PLATFORMS[host] ?? site.charAt(0).toUpperCase() + site.slice(1);
}

/**
 * The bulk-savings promo that sits above the footer columns: a small label, the
 * offer, its fine print, and a call-to-order button.
 *
 * Footer chrome, like the review band — which is why the page harvester never
 * saw it and the block was missing from all 322 pages. The home page's FAQ
 * happens to answer a similar question in different words, so the loss was easy
 * to miss when reading the rendered clone.
 *
 * Anchored on the h4 label rather than on its text, so the copy can be reworded
 * without silently dropping the block.
 */
function bulkOffer($) {
  const headings = $('.ekit-template-content-footer')
    .find('.elementor-widget-heading')
    .toArray()
    .map((el) => {
      const $h = $(el).find('.elementor-heading-title').first();
      return { tag: ($h[0]?.tagName || '').toLowerCase(), text: clean($h.text()), el };
    })
    .filter((h) => h.text);

  const at = headings.findIndex((h) => h.tag === 'h4');
  if (at === -1) return null;

  // The lines that belong to the promo are the h2s directly after its label.
  const lines = [];
  for (let i = at + 1; i < headings.length && headings[i].tag === 'h2'; i += 1) {
    lines.push(headings[i].text);
  }
  if (!lines.length) return null;

  const $button = $('.ekit-template-content-footer').find('.elementor-button-link').first();

  return {
    title: headings[at].text,
    lines,
    cta: clean($button.find('.elementor-button-text').first().text()) || null,
    ctaHref: $button.attr('href') || null,
  };
}

/**
 * Find the link group that follows a given heading. The footer renders each
 * column as a heading widget followed by a separate link-list widget, so the
 * links are a sibling of the heading, not a child of it.
 */
function groupAfter(blocks, headingMatcher, what) {
  const i = blocks.findIndex((b) => b.heading && headingMatcher.test(b.heading));
  if (i === -1) throw new Error(`Footer: no heading matching ${headingMatcher} (${what})`);
  const group = blocks.slice(i + 1).find((b) => b.links.length > 0);
  if (!group) throw new Error(`Footer: heading "${blocks[i].heading}" has no link list after it`);
  return group.links;
}

async function main() {
  console.log('Fetching / and /es/ …');
  const [$en, $es] = await Promise.all([load('/'), load('/es/')]);

  // ---- Header navigation ------------------------------------------------
  const navEn = readNav($en);
  const navEs = readNav($es);
  const nav = pairLists(navEn, navEs, 'Header nav').map(([en, es]) => ({
    label_en: en.label,
    label_es: es.label,
    // Links are stored as the ENGLISH canonical path. The Spanish path is
    // resolved at render time from data/routes.json, because Spanish slugs are
    // translated and cannot be derived. See docs/url-inventory.md.
    href: en.href,
    children: pairLists(en.children, es.children, `Nav children of "${en.label}"`).map(
      ([ce, cs]) => ({ label_en: ce.label, label_es: cs.label, href: ce.href })
    ),
  }));

  // ---- Announcement bar -------------------------------------------------
  //
  // The bar ships several responsive variants of the same sentence — a USD one
  // and a colón one. Checked in a real browser at desktop width: the USD
  // variant is hidden and the COLÓN variant is the one visitors actually see.
  // So the colón variant is the copy to reproduce.
  //
  // (The repo previously hardcoded "FREE Shipping On Orders Above $200 /
  // ₡90,896" — a merge of the two that appears nowhere on the live site.)
  const shipping = (lang$, re) => {
    const variants = lang$('.ekit-template-content-header')
      .find('*')
      .toArray()
      .filter((el) => lang$(el).children().length === 0 && re.test(lang$(el).text()))
      .map((el) => clean(lang$(el).text()));
    const colones = variants.find((v) => v.includes('₡'));
    if (!colones) throw new Error(`Announcement bar: no colón variant found for ${re}`);
    return colones;
  };

  /** Phone/email links in the header bar, which are labelled per language. */
  const headerContact = (lang$) =>
    [
      ...new Map(
        lang$('.ekit-template-content-header a')
          .toArray()
          .map((a) => ({ label: clean(lang$(a).text()), href: (lang$(a).attr('href') || '').trim() }))
          .filter((l) => /^(tel:|mailto:)/i.test(l.href))
          .map((l) => [l.href, l])
      ).values(),
    ];

  // ---- Footer -----------------------------------------------------------
  const blocksEn = footerBlocks($en);
  const blocksEs = footerBlocks($es);
  pairLists(blocksEn, blocksEs, 'Footer blocks');

  const pairGroup = (matcherEn, what) => {
    const en = groupAfter(blocksEn, matcherEn, what);
    const iEn = blocksEn.findIndex((b) => b.links === en);
    const es = blocksEs[iEn]?.links ?? [];
    return pairLists(en, es, `Footer ${what}`).map(([a, b]) => ({
      label_en: a.label,
      label_es: b.label,
      href: a.href,
    }));
  };

  const quickLinks = pairGroup(/^Quick Links$/i, 'quick links');
  const categories = pairGroup(/^Shop By Categories$/i, 'categories');
  const contactLinks = pairGroup(/^Contact Us$/i, 'contact');

  // Social profiles are external absolute URLs — same in both languages.
  const socialBlock = blocksEn.find((b) =>
    b.links.some((l) => /facebook\.com|instagram\.com|youtube\.com|tiktok\.com|linkedin\.com|x\.com|pinterest\./i.test(l.href || ''))
  );
  const social = (socialBlock?.links ?? [])
    .filter((l) => /^https?:/i.test(l.href))
    .map((l) => ({ name: socialName(l.label, l.href), href: l.href }));

  const longestText = (blocks, re) =>
    blocks.filter((b) => b.text && re.test(b.text)).sort((a, b) => b.text.length - a.text.length)[0]
      ?.text ?? null;

  const disclaimerEn = longestText(blocksEn, /laboratory research use only/i);
  const disclaimerEs = longestText(blocksEs, /investigación de laboratorio|uso exclusivo/i);
  const blurbEn = longestText(blocksEn, /premium, research-backed peptides/i);
  const blurbEs = longestText(blocksEs, /péptidos premium|respaldados por/i);
  const copyEn = blocksEn.find((b) => /^Copyright ©/i.test(b.heading || ''))?.heading ?? null;
  const copyEs = blocksEs.find((b) => /^(Copyright|Derechos) ?©/i.test(b.heading || ''))?.heading ?? null;

  // Platform names and numerals are identical in both languages, so the band is
  // paired by index like every other footer list rather than translated.
  const reviewsEn = reviewBand($en);
  const reviewsEs = reviewBand($es);
  if (!reviewsEn.length) throw new Error('Footer: no review band found');
  const reviews = pairLists(reviewsEn, reviewsEs, 'Footer review band').map(([en, es]) => ({
    ...en,
    href_es: es.href ?? en.href,
  }));

  const bulkEn = bulkOffer($en);
  const bulkEs = bulkOffer($es);
  if (!bulkEn) throw new Error('Footer: no bulk-savings promo found');
  pairLists(bulkEn.lines, bulkEs?.lines ?? [], 'Footer bulk offer lines');
  const bulk = {
    title_en: bulkEn.title,
    title_es: bulkEs.title,
    lines_en: bulkEn.lines,
    lines_es: bulkEs.lines,
    cta_en: bulkEn.cta,
    cta_es: bulkEs.cta,
    cta_href: bulkEn.ctaHref,
  };

  for (const [name, value] of Object.entries({
    disclaimerEn, disclaimerEs, blurbEn, blurbEs, copyEn, copyEs,
  })) {
    if (!value) throw new Error(`Footer: could not find ${name}`);
  }

  const payload = {
    harvestedAt: new Date().toISOString(),
    origin: ORIGIN,
    announcement: {
      text_en: shipping($en, /FREE Shipping/i),
      text_es: shipping($es, /GRATIS/i),
    },
    headerContact: pairLists(
      headerContact($en),
      headerContact($es),
      'Header contact links'
    ).map(([en, es]) => ({ label_en: en.label, label_es: es.label, href: en.href })),
    nav,
    footer: {
      blurb_en: blurbEn,
      blurb_es: blurbEs,
      disclaimer_en: disclaimerEn,
      disclaimer_es: disclaimerEs,
      copyright_en: copyEn,
      copyright_es: copyEs,
      quickLinks,
      categories,
      contactLinks,
      social,
      bulk,
      reviews,
    },
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${OUT}`);
  console.log(`  nav: ${nav.length} top items (${nav.map((n) => n.children.length).join('/')} children)`);
  console.log(`  quick links ${quickLinks.length} · categories ${categories.length} · contact ${contactLinks.length} · social ${social.length}`);
  console.log(`  announcement EN: ${payload.announcement.text_en}`);
  console.log(`  announcement ES: ${payload.announcement.text_es}`);
}

main().catch((err) => {
  console.error(`\nHarvest failed: ${err.message}`);
  process.exitCode = 1;
});
