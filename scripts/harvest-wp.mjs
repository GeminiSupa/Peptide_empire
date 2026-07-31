/**
 * Harvest the complete English content corpus from the live WordPress REST API.
 *
 * Writes data/wp/{pages,posts,product,product_cat,media,users}.json — the raw
 * REST payloads, unmodified. Downstream scripts derive page content from these
 * rather than re-fetching the network, so a harvest is reproducible offline.
 *
 * Why this exists: the live site leaves /wp-json/ open and unauthenticated, so
 * the entire corpus is publicly readable. That makes a WXR export from the
 * WordPress maintainer unnecessary for English content — this script is the
 * export.
 *
 * What this does NOT cover, and cannot:
 *   - Spanish. TranslatePress stores translations in its own wp_trp_dictionary_*
 *     tables and does not expose them over REST. Every REST response is English
 *     regardless of ?lang=es. Spanish has to come from the rendered /es/ HTML
 *     (see harvest-home.mjs) or from a database dump.
 *   - Drafts, private, and scheduled posts. REST returns published only.
 *
 * Elementor layouts arrive as rendered HTML in content.rendered, which is what
 * the rebuild consumes. The raw _elementor_data JSON is not exposed and is not
 * needed.
 *
 * Usage: node scripts/harvest-wp.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'data/wp');

/** Expected minimums, as observed on 2026-07-31. A large drop means the
 *  harvest is being throttled or the API was locked down — fail, don't write
 *  a truncated corpus over a good one. */
const EXPECTED = {
  pages: 200,
  posts: 12,
  product: 60,
  product_cat: 14,
  media: 380,
  users: 1,
};

/** Rows X-WP-Total counts but REST will not serve. See harvestType(). */
const KNOWN_UNREACHABLE = {
  media: 4,
};

const PER_PAGE = 100;

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url);
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`${res.status} after ${attempt} attempts: ${url}`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return { body: await res.json(), total: Number(res.headers.get('x-wp-total')) || 0 };
}

/** Page through a REST collection until every item is retrieved. */
async function harvestType(type) {
  const first = await fetchJson(
    `${ORIGIN}/wp-json/wp/v2/${type}?per_page=${PER_PAGE}&page=1`,
  );
  const total = first.total;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = [...first.body];

  for (let p = 2; p <= pages; p += 1) {
    const next = await fetchJson(
      `${ORIGIN}/wp-json/wp/v2/${type}?per_page=${PER_PAGE}&page=${p}`,
    );
    items.push(...next.body);
  }

  const unique = [...new Map(items.map((i) => [i.id, i])).values()];

  // media reports 403 but serves 399. Verified 2026-07-31: paging by date, id
  // and title each return the identical 399 ids, so 4 attachment rows exist in
  // the database that REST counts and then withholds — orphaned rows whose
  // parent post is gone, most likely. 399 is the complete public set, not a
  // truncated read. Any *other* shortfall is a real failure.
  const known = KNOWN_UNREACHABLE[type] ?? 0;
  if (unique.length !== total - known) {
    throw new Error(
      `${type}: collected ${unique.length} but X-WP-Total says ${total} ` +
        `(allowing for ${known} known-unreachable). Refusing to write a partial corpus.`,
    );
  }
  items.length = 0;
  items.push(...unique);
  const floor = EXPECTED[type];
  if (floor && items.length < floor) {
    throw new Error(
      `${type}: got ${items.length}, expected at least ${floor}. ` +
        `Either the API is throttling or content was deleted — check before rerunning.`,
    );
  }
  return items;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const summary = [];

  for (const type of Object.keys(EXPECTED)) {
    process.stdout.write(`${type}… `);
    const items = await harvestType(type);
    const file = resolve(OUT_DIR, `${type}.json`);
    await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
    console.log(`${items.length}`);
    summary.push([type, items.length]);
  }

  console.log('\nHarvested to data/wp/:');
  for (const [type, n] of summary) console.log(`  ${String(n).padStart(4)}  ${type}`);
  console.log('\nEnglish only — see the header comment for why Spanish is not here.');
}

main().catch((err) => {
  console.error(`\nharvest-wp failed: ${err.message}`);
  process.exit(1);
});
