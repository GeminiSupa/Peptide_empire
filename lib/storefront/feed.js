import { cache } from 'react';
import { groupRows } from '@/lib/storefront/group-products.mjs';
import { getUsdToCrcRate } from '@/lib/storefront/exchange-rate';
import { hiddenNamesFrom, withoutHidden } from '@/lib/storefront/hidden-products.mjs';
import { currentSite } from '@/lib/site/current-site.mjs';

/**
 * Reading the catalog's product rows.
 *
 * All the shaping lives in `group-products.mjs`, which is pure and unit
 * tested. This file is only the fetch, the cache window and the failure
 * behaviour.
 */

// This is the catalog's public browser key, already shipped to visitors by the
// catalog site. Only public product fields are read with it.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://cbanvzipzfmllexraiei.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';

const FIELDS = [
  'id', 'product', 'category', 'price_usd', 'status', 'coa', 'image_url',
  'priority', 'inventory_count', 'vial_size', 'is_default_size',
  'description_en', 'description_es', 'discount',
  'free_bac_water', 'free_bac_size_ml', 'free_bac_vials_per_item',
  // A product sale set in the admin: the struck-through price and its window.
  'original_price_usd', 'sale_start_time', 'sale_end_time',
].join(',');

const productsUrl = (siteId) => `${SUPABASE_URL}/rest/v1/products`
  + `?select=${FIELDS}&site_id=eq.${siteId}&order=priority.asc&limit=1000`;

const HIDDEN_URL = `${SUPABASE_URL}/rest/v1/site_settings?select=value&id=eq.hidden_products`;

/** Stock and prices move during the day; 60s is what the marketing site already used. */
const REVALIDATE_SECONDS = 60;

async function fetchRows(siteId) {
  const response = await fetch(productsUrl(siteId), {
    headers: { apikey: SUPABASE_ANON_KEY },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`products feed ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('products feed returned no array');
  return rows;
}

/** The last list read successfully by this server instance. */
let lastHiddenNames = null;

/**
 * The products the catalog admin hid (see hidden-products.mjs).
 *
 * If the list cannot be read, the last list this instance read is used. With
 * none to fall back on this throws, and the feed reports itself down: showing
 * — and taking orders for — products staff took off sale is worse than the
 * shop's "unavailable" notice, which the next revalidation clears.
 */
async function fetchHiddenNames() {
  try {
    const response = await fetch(HIDDEN_URL, {
      headers: { apikey: SUPABASE_ANON_KEY },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`hidden products ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('hidden products returned no array');
    lastHiddenNames = hiddenNamesFrom(rows);
    return lastHiddenNames;
  } catch (error) {
    console.error('[storefront] hidden products list unavailable:', error.message);
    if (lastHiddenNames) return lastHiddenNames;
    throw error;
  }
}

/**
 * The whole storefront catalog: compounds, and the rate the colón prices were
 * derived at.
 *
 * Throws nothing. A feed that cannot be read yields `ok: false` and no
 * compounds, which the page renders as a notice — a shop with no products and
 * a working checkout button is worse than a shop that says it is down.
 */
export const getStorefrontCatalog = cache(async () => {
  const site = await currentSite();
  const exchangeRate = await getUsdToCrcRate();

  try {
    const [rows, hidden] = await Promise.all([fetchRows(site.id), fetchHiddenNames()]);
    return { compounds: groupRows(withoutHidden(rows, hidden), exchangeRate), exchangeRate, ok: true };
  } catch (error) {
    console.error('[storefront] product feed unavailable:', error.message);
    return { compounds: [], exchangeRate, ok: false };
  }
});

/** One compound by slug, or null. */
export async function getCompound(slug) {
  const { compounds } = await getStorefrontCatalog();
  return compounds.find((compound) => compound.slug === slug) || null;
}

/**
 * The flat vial rows the Google Ads landing pages read (app/api/lp/products).
 *
 * Those pages are standalone HTML copied from the catalog
 * (scripts/sync-landing-pages.mjs) and ship with a snapshot of the catalog
 * baked in; on load each one replaces that snapshot with this list, so the
 * price and the stock badge on a paid click are the live ones. They need the
 * rows one per vial, not grouped into compounds, in the catalog's own field
 * names — so this is a second read rather than a reshaping of
 * getStorefrontCatalog().
 *
 * `price_crc` is the catalog's own stored colón price, used as it is: these
 * pages price entirely in colones and the figure must be the one checkout
 * charges, never one re-derived here from an exchange rate.
 */
const LP_FIELDS = [
  'product', 'category', 'price_usd', 'price_crc', 'status',
  'inventory_count', 'coa', 'image_url', 'vial_size', 'priority',
].join(',');

const LP_PRODUCTS_URL = `${SUPABASE_URL}/rest/v1/products`
  + `?select=${LP_FIELDS}&order=priority.asc&limit=1000`;

export async function getLandingPageProducts() {
  const response = await fetch(LP_PRODUCTS_URL, {
    headers: { apikey: SUPABASE_ANON_KEY },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`landing page products ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('landing page products returned no rows');

  const hidden = await fetchHiddenNames();
  return withoutHidden(rows, hidden).map((row) => ({
    product: row.product,
    category: row.category,
    priceUsd: row.price_usd,
    priceCrc: row.price_crc,
    // The catalog's own rule: a row with no stock reads Out of Stock whatever
    // its status column says (mapDbProduct in its src/lib/catalogProducts.js).
    status: row.inventory_count === 0 ? 'Out of Stock' : row.status,
    inventoryCount: row.inventory_count ?? null,
    coa: row.coa,
    // No fallback image: the catalog's fallbacks are files in its own public/
    // folder, and these pages never read this field — they draw a product from
    // their own photo map, keyed by name.
    imageUrl: row.image_url || null,
    vialSize: row.vial_size || '',
  }));
}
