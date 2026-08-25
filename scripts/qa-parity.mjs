/**
 * Content-parity check: our page vs the live page, measured.
 *
 * qa-check.mjs finds pages that are broken. This finds pages that render fine
 * but are missing content — a section the harvester silently dropped, images
 * that never made it, a heading tree that lost half its nodes. Those never
 * throw and never 404, so nothing else catches them.
 *
 * For each page it compares four measurable things against the live site:
 * words, headings, images and links. A page is reported when it falls short by
 * more than the tolerance — surplus is not reported, since our chrome differs
 * (no WooCommerce cart widget, no plugin markup) and legitimately adds nodes.
 *
 * Live requests are serialised deliberately. The site rate-limits and starts
 * refusing connections under concurrency, which shows up as false failures.
 *
 * Usage:
 *   npm start                                  # in another shell
 *   node scripts/qa-parity.mjs --sample 3      # 3 pages per group (fast)
 *   node scripts/qa-parity.mjs --group city
 *   node scripts/qa-parity.mjs                 # everything (slow)
 */

import * as cheerio from 'cheerio';
import routeData from '../data/routes.json' with { type: 'json' };

const LIVE = 'https://peptidescostarica.net';
const LOCAL = process.env.QA_BASE || 'http://localhost:3000';

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? null : args[i + 1];
};
const groupFilter = arg('group');
const sample = Number(arg('sample')) || 0;

/** Below these, a shortfall is noise rather than missing content. */
const TOLERANCE = { words: 0.6, headings: 0.6, images: 0.5, links: 0.5 };
const MIN_LIVE = { words: 120, headings: 3, images: 2, links: 8 };

const SKIP = new Set(['excludeCandidate']);
let routes = routeData.routes.filter((r) => !SKIP.has(r.group));
if (groupFilter) routes = routes.filter((r) => r.group === groupFilter);

if (sample) {
  const byGroup = new Map();
  for (const r of routes) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    if (byGroup.get(r.group).length < sample) byGroup.get(r.group).push(r);
  }
  routes = [...byGroup.values()].flat();
}

/**
 * Measure the CONTENT area only. The live site's chrome carries a mega menu,
 * a cart and a plugin-rendered footer that our clone does not reproduce
 * verbatim, so comparing whole documents measures the chrome, not the page.
 */
/**
 * Word-count text, with a space wherever a tag boundary was.
 *
 * cheerio's .text() concatenates adjacent inline elements, and the two sides
 * are formatted very differently: WordPress ships newlines between elements,
 * React minifies them away. So `<td>BPC-157</td><td>Download PDF</td>` counted
 * as ONE word for us and three for the live page — /lab-tests-coa-results/
 * reported 94 words against 170 while rendering all 38 identical rows. That is
 * the measurement being wrong, not the page.
 *
 * Applied to both sides identically, so the comparison stays fair.
 */
function words(html) {
  const spaced = (html || '').replace(/<[^>]+>/g, ' ');
  // Re-parsed so entities (&amp;, &nbsp;) decode rather than counting as words.
  return cheerio
    .load(`<div>${spaced}</div>`)
    .root()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
}

function measure(html, isLive) {
  const $ = cheerio.load(html);
  $('script, style, noscript, header, footer, nav').remove();
  const root = isLive
    ? $('#content, .entry-content, main').first()
    : $('main').first();
  const scope = root.length ? root : $('body');

  const text = words(scope.html());
  return {
    words: text ? text.split(' ').length : 0,
    headings: scope.find('h1,h2,h3,h4,h5,h6').length,
    images: new Set(
      scope
        .find('img')
        .toArray()
        .map((el) => {
          const src =
            $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || '';
          // Compare by filename: ours are resized through /_next/image.
          const m = src.match(/([^/?]+)\.(jpg|jpeg|png|webp|gif|svg|avif)/i);
          return m ? m[1].replace(/-\d+x\d+$/, '').toLowerCase() : '';
        })
        .filter(Boolean)
    ).size,
    links: scope.find('a').length,
  };
}

async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'peptidescostarica-rebuild-parity' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const findings = [];
let checked = 0;

for (const route of routes) {
  const path = route.en;
  let live;
  let ours;
  try {
    live = measure(await get(LIVE + path), true);
  } catch (err) {
    findings.push({ path, group: route.group, kind: 'LIVE_UNREACHABLE', detail: err.message });
    continue;
  }
  try {
    ours = measure(await get(LOCAL + path), false);
  } catch (err) {
    findings.push({ path, group: route.group, kind: 'LOCAL_ERROR', detail: err.message });
    continue;
  }

  checked += 1;
  for (const key of Object.keys(TOLERANCE)) {
    if (live[key] < MIN_LIVE[key]) continue;
    const ratio = ours[key] / live[key];
    if (ratio < TOLERANCE[key]) {
      findings.push({
        path,
        group: route.group,
        kind: `LOW_${key.toUpperCase()}`,
        detail: `${ours[key]} vs ${live[key]} live (${Math.round(ratio * 100)}%)`,
      });
    }
  }
  if (checked % 25 === 0) process.stdout.write(`  …${checked}/${routes.length}\n`);
}

console.log(`\n${'='.repeat(64)}`);
console.log(`${checked} pages compared with the live site · ${findings.length} shortfalls`);
console.log('='.repeat(64));

const byKind = new Map();
for (const f of findings) {
  if (!byKind.has(f.kind)) byKind.set(f.kind, []);
  byKind.get(f.kind).push(f);
}
for (const [kind, items] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${kind}  (${items.length})`);
  for (const i of items.slice(0, 12)) console.log(`  ${i.path}  [${i.group}]  ${i.detail}`);
  if (items.length > 12) console.log(`  …and ${items.length - 12} more`);
}
if (!findings.length) console.log('\nNo content shortfalls.');
