/**
 * Style-fidelity audit: what the live stylesheet DECLARES for each widget,
 * against what our built HTML actually carries.
 *
 * qa-parity.mjs counts content — words, headings, images, links — so it catches
 * a page that is missing things. It cannot see a page that has everything at the
 * wrong size, in the wrong colour, or stretched across the wrong width, which is
 * the entire class of defect that makes a pixel-copy look nothing like its
 * original. This reads the other half.
 *
 * NO BROWSER. The live side is its raw HTML plus its per-post Elementor
 * stylesheet, parsed with the very module the harvester uses — so a property
 * this reports as missing is a property the harvester genuinely did not carry,
 * not a rendering difference. Our side is the static HTML `next build` emitted,
 * where every harvested value lands as an inline style. Widgets are matched
 * between the two by heading text and by image filename.
 *
 * Usage:
 *   node scripts/qa-style-parity.mjs                     # home page
 *   node scripts/qa-style-parity.mjs --page /about/ --post 123
 *   node scripts/qa-style-parity.mjs --all               # every cached capture
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { parseElementorCss, parseGlobals } from './lib/elementor-css.mjs';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.qa-cache');

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? null : args[i + 1];
};
const pagePath = arg('page') ?? '/';

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 34);

async function cached(name, url) {
  await mkdir(CACHE, { recursive: true });
  const file = resolve(CACHE, name);
  if (existsSync(file)) return readFile(file, 'utf8');
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': 'peptidescostarica-rebuild-qa' } });
  } catch (err) {
    // Name the URL: a bare "fetch failed" gives no clue which of the three
    // requests (page, page CSS, kit CSS) actually died.
    throw new Error(`${url} -> ${err.cause?.message ?? err.message}`);
  }
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const body = await res.text();
  await writeFile(file, body, 'utf8');
  return body;
}

/** The built file Next.js emitted for a route. */
const builtPath = (p) => {
  const slug = p.replace(/^\/|\/$/g, '');
  return resolve(ROOT, '.next/server/app', slug === '' ? 'index.html' : `${slug}.html`);
};

/**
 * The post id of the PAGE, from the `elementor elementor-<id>` wrapper.
 *
 * A page carries several: the header template and the footer template each
 * have their own. Taking the first match picked the header (5469) and audited
 * the home page against the wrong stylesheet, which reported everything as
 * undeclared. The page's own wrapper is the one inside #content.
 */
const postId = (html) => {
  const $ = cheerio.load(html);
  const scope = $('#content').length ? $('#content') : $('body');
  const el = scope.find('div.elementor[class*="elementor-"]').first();
  const m = /\belementor-(\d+)\b/.exec(el.attr('class') ?? '');
  return m?.[1] ?? /class="[^"]*\belementor-(\d+)\b/.exec(html)?.[1] ?? null;
};

async function main() {
  const key = pagePath.replace(/[^\w]+/g, '_') || 'home';
  const liveHtml = await cached(`${key}.html`, ORIGIN + pagePath);

  const id = arg('post') ?? postId(liveHtml);
  if (!id) throw new Error(`could not find the elementor post id for ${pagePath}`);
  const css = await cached(
    `post-${id}.css`,
    `${ORIGIN}/wp-content/uploads/elementor/css/post-${id}-peptidescostarica.net.css`,
  );

  const built = builtPath(pagePath);
  if (!existsSync(built)) throw new Error(`no built page at ${built} — run \`npm run build\` first`);
  const oursHtml = await readFile(built, 'utf8');

  /**
   * The kit stylesheet, for `var(--e-global-color-*)`.
   *
   * Without it every colour the live page states through a global reads back
   * as the unresolved `var(...)` text and every heading looks like a mismatch
   * - 10 false positives on the home page alone. The harvester resolves these,
   * so the audit has to as well, or it compares a value with a variable name.
   */
  let globals = {};
  try {
    const kitId = /elementor-kit-(\d+)/.exec(liveHtml)?.[1];
    if (kitId) {
      globals = parseGlobals(
        await cached(
          `kit-${kitId}.css`,
          `${ORIGIN}/wp-content/uploads/elementor/css/post-${kitId}-peptidescostarica.net.css`,
        ),
      );
    }
  } catch {
    console.log('  (kit stylesheet unavailable - colour checks skipped)');
  }
  const declared = parseElementorCss(css, globals);
  const $l = cheerio.load(liveHtml);
  const $o = cheerio.load(oursHtml);

  // --- what the live page declares, keyed so our side can be matched to it ---
  const liveHeadings = new Map();
  $l('[data-widget_type^="heading"]').each((_, el) => {
    const $w = $l(el);
    const d = declared.get($w.attr('data-id')) ?? {};
    const h = $w.find('h1,h2,h3,h4,h5,h6').first();
    const text = norm(h.text());
    if (!text) return;
    liveHeadings.set(text, {
      tag: (h[0]?.tagName ?? '').toUpperCase(),
      size: d['font-size'] ?? null,
      weight: d['font-weight'] ?? null,
      color: d.color ?? null,
      align: d['text-align'] ?? null,
    });
  });

  const liveImages = new Map();
  $l('[data-widget_type^="image"]').each((_, el) => {
    const $w = $l(el);
    const d = declared.get($w.attr('data-id')) ?? {};
    const img = $w.find('img').first();
    const raw = img.attr('data-breeze') || img.attr('data-lazy-src') || img.attr('src') || '';
    const file = raw.split('?')[0].split('/').pop();
    if (file) liveImages.set(file, d['img-width'] ?? null);
  });

  const inline = (el, prop) => {
    const st = $o(el).attr('style') ?? '';
    return new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(st)?.[1]?.trim() ?? null;
  };

  /**
   * Alignment is a Tailwind CLASS on our side, not an inline style - reading
   * only the style attribute reported all 13 centred headings as unaligned.
   */
  const alignOf = (el) => {
    const cls = $o(el).attr('class') ?? '';
    if (/\btext-center\b/.test(cls)) return 'center';
    if (/\btext-right\b/.test(cls)) return 'right';
    if (/\btext-left\b/.test(cls)) return 'left';
    return inline(el, 'text-align');
  };

  /** Elementor writes `start`/`end`; CSS and Tailwind say `left`/`right`. */
  const sameAlign = (ours, live) => {
    const canon = (v) => ({ start: 'left', end: 'right' })[v] ?? v;
    return canon(ours) === canon(live) || (live === 'start' && ours === null);
  };

  const findings = { size: [], weight: [], color: [], align: [], tag: [], width: [] };
  let matched = 0;

  $o('main h1,main h2,main h3,main h4,main h5,main h6').each((_, el) => {
    const text = norm($o(el).text());
    const l = liveHeadings.get(text);
    if (!l) return;
    matched += 1;
    const label = text.slice(0, 32);
    const size = inline(el, 'font-size');
    const weight = inline(el, 'font-weight');
    const color = inline(el, 'color');
    const align = alignOf(el);
    if (l.size && size !== l.size) findings.size.push(`${label} :: ${size ?? '(none)'} vs ${l.size}`);
    if (l.weight && weight !== l.weight) findings.weight.push(`${label} :: ${weight ?? '(none)'} vs ${l.weight}`);
    if (l.color && (color ?? '').toLowerCase() !== l.color.toLowerCase())
      findings.color.push(`${label} :: ${color ?? '(none)'} vs ${l.color}`);
    if (l.align && !sameAlign(align, l.align))
      findings.align.push(`${label} :: ${align ?? '(none)'} vs ${l.align}`);
    if (l.tag && el.tagName.toUpperCase() !== l.tag)
      findings.tag.push(`${label} :: ${el.tagName.toUpperCase()} vs ${l.tag}`);
  });

  let imatched = 0;
  $o('main img').each((_, el) => {
    const file = ($o(el).attr('src') ?? '').split('?')[0].split('/').pop();
    if (!liveImages.has(file)) return;
    imatched += 1;
    const want = liveImages.get(file);
    if (want && !inline(el, 'width')) findings.width.push(`${file} :: (none) vs ${want}`);
  });

  console.log(`${pagePath}  (elementor post ${id})`);
  console.log(`  headings matched ${matched}/${liveHeadings.size} · images matched ${imatched}/${liveImages.size}`);

  const total = Object.values(findings).reduce((a, v) => a + v.length, 0);
  for (const [kind, list] of Object.entries(findings)) {
    if (!list.length) continue;
    console.log(`\n  ${kind.toUpperCase()} — ${list.length}`);
    for (const f of list.slice(0, 12)) console.log(`    ${f}`);
    if (list.length > 12) console.log(`    …and ${list.length - 12} more`);
  }
  console.log(total ? `\n${total} style mismatch(es).` : '\nNo style mismatches.');
}

main().catch((err) => {
  console.error(`\nqa-style-parity failed: ${err.message}`);
  process.exitCode = 1;
});
