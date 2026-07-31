/**
 * Harvest commerce fields for the 67 products from the WooCommerce Store API
 * into data/wp/store-products.json.
 *
 * WHY A SECOND PRODUCT SOURCE
 *
 * The WordPress REST product collection (data/wp/product.json) carries the post
 * — slug, title, taxonomy terms — but not the commerce data. Price, currency,
 * gallery images and category links come from the Store API instead. Both are
 * public and unauthenticated.
 *
 * WHAT IS AND IS NOT KEPT
 *
 * Kept: name, slug, price, currency, images, categories. That is what a display
 * page needs.
 *
 * Not kept: stock quantities, "add to cart" state, variations, nonces. This
 * project has no cart and must never grow one — the catalog site owns checkout
 * and orders. Storing cart state here would invite exactly that.
 *
 * Prices are a SNAPSHOT taken at harvest time, not a live feed. The catalog
 * site remains the authority on what anything costs; re-run this before launch.
 *
 * Usage: node scripts/harvest-store.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/wp/store-products.json');

const PER_PAGE = 100;
const EXPECTED_MIN = 60;

const strip = (v) => (v ? v.replace(/^https?:\/\/[^/]+/, '') : null);

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { body: await res.json(), total: Number(res.headers.get('x-wp-total')) || 0 };
  } catch (err) {
    if (attempt >= 4) throw new Error(`${url} -> ${err.message} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return fetchJson(url, attempt + 1);
  }
}

/** Money as a display string, from the Store API's minor-unit integers. */
function formatPrice(prices) {
  if (!prices?.price) return '';
  const minor = Number(prices.currency_minor_unit ?? 0);
  const value = Number(prices.price) / 10 ** minor;
  const body = value.toLocaleString('en-US', {
    minimumFractionDigits: minor,
    maximumFractionDigits: minor,
  });
  return `${prices.currency_prefix ?? prices.currency_symbol ?? ''}${body}${
    prices.currency_suffix ?? ''
  }`;
}

async function main() {
  const fields = 'id,name,slug,prices,images,categories';
  const first = await fetchJson(
    `${ORIGIN}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=1&_fields=${fields}`,
  );
  const total = first.total || first.body.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const raw = [...first.body];

  for (let p = 2; p <= pages; p += 1) {
    const next = await fetchJson(
      `${ORIGIN}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${p}&_fields=${fields}`,
    );
    raw.push(...next.body);
  }

  const unique = [...new Map(raw.map((p) => [p.id, p])).values()];
  if (unique.length < EXPECTED_MIN) {
    throw new Error(
      `Got ${unique.length} products, expected at least ${EXPECTED_MIN}. ` +
        `Refusing to overwrite a good snapshot with a short read.`,
    );
  }

  const products = unique
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: formatPrice(p.prices),
      currency: p.prices?.currency_code ?? null,
      images: (p.images ?? []).map((img) => strip(img.src)).filter(Boolean),
      categories: (p.categories ?? []).map((c) => ({ name: c.name, slug: c.slug })),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      {
        harvestedAt: new Date().toISOString(),
        note: 'Price is a snapshot. The catalog site is the authority on pricing.',
        count: products.length,
        products,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const withPrice = products.filter((p) => p.price).length;
  const cats = new Set(products.flatMap((p) => p.categories.map((c) => c.slug)));
  console.log(`Wrote ${products.length} products → data/wp/store-products.json`);
  console.log(`  ${withPrice} have a price · ${cats.size} distinct categories`);
}

main().catch((err) => {
  console.error(`\nharvest-store failed: ${err.message}`);
  process.exit(1);
});
