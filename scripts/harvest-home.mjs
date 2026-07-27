/**
 * Harvest the home page into data/pages/home.json as an ordered section array.
 *
 * Output shape mirrors the future `site_cms_page_sections` rows exactly:
 *   { type, content: { <field>_en, <field>_es, ... } }
 * Array index is sort_order. Migrating this into the database later is a
 * flatten-and-insert, not a rewrite.
 *
 * Method: the English and Spanish pages render the same Elementor widgets in
 * the same order, so widget N on one is the twin of widget N on the other.
 * ANCHORS below re-checks that on every run against known English text at known
 * positions; if the page is re-ordered in WordPress the run fails instead of
 * silently pairing the wrong translations.
 *
 * Usage: node scripts/harvest-home.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/pages/home.json');

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const rel = (h) => {
  const v = (h || '').trim();
  if (!v) return null;
  return v.startsWith(ORIGIN) ? v.slice(ORIGIN.length) || '/' : v;
};

/** Widget positions must still hold this English text, or the map is stale. */
const ANCHORS = {
  1: 'Premium Peptides in Costa Rica',
  8: 'AS SEEN IN',
  14: 'We do things differently',
  24: 'Shop By Category',
  34: 'What We Offer',
  54: 'Who This Is For',
  62: 'CUSTOMER TRANSFORMATION',
  75: 'BULK OFFER',
  85: 'Your Trusted Peptide Supplier in Costa Rica',
  107: 'Why choose us',
  114: 'Testimonials',
  119: 'Frequently Asked Questions',
};

async function load(path) {
  const res = await fetch(ORIGIN + path, {
    headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return cheerio.load(await res.text());
}

/** Every Elementor widget on the page body, in document order. */
function widgets($) {
  return $('div.elementor.elementor-12201 .elementor-widget-container').toArray();
}

function main$(en, es) {
  const w = { en: widgets(en), es: widgets(es) };
  if (w.en.length !== w.es.length) {
    throw new Error(
      `Home page widget counts differ: EN ${w.en.length} vs ES ${w.es.length}. ` +
        `Positional pairing is invalid — aborting rather than emitting wrong Spanish.`
    );
  }

  const stale = Object.entries(ANCHORS)
    .filter(([i, text]) => !clean(en(w.en[Number(i)]).text()).startsWith(text))
    .map(([i, text]) => `widget ${i} should start "${text}", found "${clean(en(w.en[Number(i)]).text()).slice(0, 60)}"`);
  if (stale.length) {
    throw new Error(`Home page layout changed:\n  ${stale.join('\n  ')}`);
  }

  /** Text of widget i, in both languages. */
  const pair = (i, key) => ({
    [`${key}_en`]: clean(en(w.en[i]).text()),
    [`${key}_es`]: clean(es(w.es[i]).text()),
  });

  /** Direct child element texts of widget i — for chip rows and bullet lists. */
  const pairList = (i, key) => {
    const items = ($$, node) => {
      const $node = $$(node);
      const kids = $node.find('li').length ? $node.find('li') : $node.children().children();
      const out = kids
        .toArray()
        .map((el) => clean($$(el).text()))
        .filter(Boolean);
      return out.length ? out : [clean($node.text())].filter(Boolean);
    };
    const a = items(en, w.en[i]);
    const b = items(es, w.es[i]);
    return {
      [`${key}_en`]: a,
      [`${key}_es`]: b.length === a.length ? b : a,
    };
  };

  /** First link inside widget i. */
  const link = (i, key) => {
    const $a = en(w.en[i]).find('a').first();
    return {
      ...pair(i, key),
      [`${key}_href`]: rel($a.attr('href')),
    };
  };

  const cards = (pairs) =>
    pairs.map(([ti, bi]) => ({ ...pair(ti, 'title'), ...pair(bi, 'body') }));

  /** Widgets where the heading and body share one container. */
  const splitCards = (indices) =>
    indices.map((i) => {
      const head = ($$, node) => clean($$(node).find('h1,h2,h3,h4,h5,h6').first().text());
      const whole = ($$, node) => clean($$(node).text());
      const strip = (all, h) => clean(all.startsWith(h) ? all.slice(h.length) : all);
      const hEn = head(en, w.en[i]);
      const hEs = head(es, w.es[i]);
      return {
        title_en: hEn,
        title_es: hEs,
        body_en: strip(whole(en, w.en[i]), hEn),
        body_es: strip(whole(es, w.es[i]), hEs),
      };
    });

  /**
   * FAQ accordion. Not an Elementor widget — it is plain native
   * <details>/<summary>, so the question is the summary and the answer is
   * whatever the details element contains once the summary is removed.
   */
  const faqItems = () => {
    const read = ($$) =>
      $$('details')
        .toArray()
        .map((el) => {
          const $el = $$(el);
          const q = clean($el.find('summary').first().text());
          const $body = $el.clone();
          $body.find('summary').remove();
          return { q, a: clean($body.text()) };
        })
        .filter((x) => x.q);
    const a = read(en);
    const b = read(es);
    if (!a.length) throw new Error('FAQ: no <details> items found');
    if (b.length !== a.length) {
      throw new Error(`FAQ: EN has ${a.length} questions, ES has ${b.length} — cannot pair`);
    }
    return a.map((item, i) => ({
      question_en: item.q,
      question_es: b[i].q,
      answer_en: item.a,
      answer_es: b[i].a,
    }));
  };

  return [
    {
      type: 'hero',
      content: {
        ...pair(0, 'eyebrow'),
        ...pair(1, 'title'),
        ...pair(2, 'intro'),
        ...pair(3, 'body'),
        ...pairList(4, 'chips'),
        ...link(5, 'cta'),
      },
    },
    {
      type: 'press_band',
      content: { ...pair(8, 'eyebrow'), ...pair(11, 'text'), ...pair(12, 'outlet'), ...link(13, 'cta') },
    },
    {
      type: 'feature_cards',
      content: {
        ...pair(14, 'title'),
        ...pair(15, 'intro'),
        columns: 4,
        cards: cards([[16, 17], [18, 19], [20, 21], [22, 23]]),
      },
    },
    { type: 'category_chips', content: { ...pair(24, 'title'), source: 'nav_categories' } },
    {
      type: 'feature_cards',
      content: {
        ...pair(34, 'title'),
        ...pair(35, 'intro'),
        columns: 3,
        cards: cards([[37, 38], [40, 41], [43, 44], [46, 47], [49, 50], [52, 53]]),
      },
    },
    {
      type: 'feature_cards',
      content: {
        ...pair(54, 'title'),
        ...pair(55, 'intro'),
        columns: 4,
        cards: splitCards([56, 57, 58, 59]),
        ...link(60, 'cta'),
      },
    },
    {
      type: 'transformation',
      content: {
        ...pair(62, 'eyebrow'),
        ...pair(63, 'title'),
        ...pair(64, 'body'),
        disclaimers_en: [clean(en(w.en[67]).text()), clean(en(w.en[68]).text()), clean(en(w.en[69]).text())],
        disclaimers_es: [clean(es(w.es[67]).text()), clean(es(w.es[68]).text()), clean(es(w.es[69]).text())],
        ...link(70, 'cta'),
      },
    },
    {
      type: 'promo_banner',
      content: { ...pair(75, 'eyebrow'), ...pair(76, 'title'), ...pair(77, 'body') },
    },
    {
      type: 'info_duo',
      content: {
        panels: [
          { ...pair(79, 'title'), ...pair(80, 'body'), ...link(81, 'cta') },
          { ...pair(82, 'title'), ...pair(83, 'body'), ...link(84, 'cta') },
        ],
      },
    },
    {
      type: 'text_cta',
      content: { ...pair(85, 'title'), ...pair(86, 'body'), ...link(87, 'cta') },
    },
    {
      type: 'call_to_order_cards',
      content: {
        cards: [
          {
            ...pair(92, 'name'),
            ...pair(94, 'badge'),
            ...pair(95, 'price'),
            ...pairList(96, 'benefits'),
            ...link(97, 'cta'),
          },
          {
            ...pair(99, 'name'),
            ...pair(101, 'badge'),
            ...pair(102, 'price'),
            ...pairList(103, 'benefits'),
            ...link(104, 'cta'),
          },
        ],
      },
    },
    {
      type: 'feature_cards',
      content: {
        ...pair(107, 'eyebrow'),
        ...pair(108, 'title'),
        ...pair(109, 'body'),
        columns: 3,
        cards: splitCards([111, 112, 113]),
      },
    },
    {
      type: 'testimonials',
      content: { ...pair(114, 'eyebrow'), ...pair(115, 'title'), ...pair(116, 'body'), items: [] },
    },
    {
      type: 'faq_accordion',
      content: {
        ...pair(118, 'eyebrow'),
        ...pair(119, 'title'),
        ...pair(120, 'intro'),
        items: faqItems(),
      },
    },
  ];
}

async function run() {
  console.log('Fetching / and /es/ …');
  const [$en, $es] = await Promise.all([load('/'), load('/es/')]);
  const sections = main$($en, $es);

  const payload = {
    harvestedAt: new Date().toISOString(),
    source: `${ORIGIN}/`,
    slug: '/',
    sections,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${OUT}`);
  console.log(`  ${sections.length} sections: ${sections.map((s) => s.type).join(', ')}`);
  const faq = sections.find((s) => s.type === 'faq_accordion');
  console.log(`  FAQ items: ${faq.content.items.length}`);
}

run().catch((err) => {
  console.error(`\nHarvest failed: ${err.message}`);
  process.exitCode = 1;
});
