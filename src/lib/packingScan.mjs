/**
 * The packer's scan-check: does each vial going into the box belong to this
 * order, and is anything still missing?
 *
 * One rule, used twice: the packing screen runs it on every scan so the packer
 * gets a green tick or a red stop on the spot, and the server runs it again on
 * save so a packing record can only say what really matches the order.
 *
 * Matching is by PRODUCT, not by spelling. Orders keep the name the customer
 * saw — "Agua Bacteriostática 3ml" on a Spanish order, "GLP-1 30mg" from before
 * a rename — while a sticker belongs to one row of the products table. Every
 * order line is first resolved to its product row (the same way checkout finds
 * it), and a sticker matches the line whose product it belongs to. BAC water is
 * matched by size, because every BAC row of one size is the same vial.
 *
 * Packing never touches stock. Stock already came off when the order was
 * placed (see inventoryRestore.mjs); this only records which batch went in.
 *
 * Relative imports only, so `node --test` can load this file directly.
 */

import { getBacWaterSizeMl, isBacWater, stripGiftSuffix } from './bacWater.mjs';
import { productNameResolver } from './authoritativeCheckout.mjs';
import { resolveDealProductName } from './catalogFilters.mjs';

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const looseKey = (value) => normalize(value).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');

/**
 * What a sticker and an order line are compared on. Two rows of BAC water of
 * one size are the same physical vial, so they share a key.
 */
export function productMatchKey(product) {
  if (!product?.product) return null;
  if (isBacWater(product.product)) return `bac:${getBacWaterSizeMl(product.product) ?? '?'}`;
  return product.id ? `id:${product.id}` : null;
}

/**
 * name on an order -> product row, or null when no single row fits.
 * Order of tries: exact / punctuation-blind name (checkout's own matcher),
 * BAC water by size, a single unambiguous rename, and finally a name with
 * its size missing that only one product starts with.
 */
export function packingProductResolver(products) {
  const list = (products || []).filter((product) => product?.product);
  const byName = productNameResolver(list);
  const names = list.map((product) => product.product);
  return (rawName) => {
    const name = stripGiftSuffix(rawName);
    if (!name) return null;
    if (isBacWater(name)) {
      const size = getBacWaterSizeMl(name);
      const sameSize = list.filter((product) => isBacWater(product.product) && getBacWaterSizeMl(product.product) === size);
      const exact = byName(name);
      return (exact && sameSize.includes(exact)) ? exact : (sameSize[0] || null);
    }
    const direct = byName(name);
    if (direct) return direct;
    const renamed = resolveDealProductName(name, names);
    if (renamed) return list.find((product) => product.product === renamed) || null;
    const start = looseKey(name);
    const startsWith = start ? list.filter((product) => looseKey(product.product).startsWith(start)) : [];
    return startsWith.length === 1 ? startsWith[0] : null;
  };
}

/**
 * What has to go in the box: one line per product. A free gift is still a
 * vial to pack, so "BAC Water 3ml (Free gift)" joins a bought "BAC Water 3ml".
 *
 * With `products`, each line is resolved to its product row; a line no row
 * fits is kept (it still has to be packed) but can only be checked by hand.
 */
export function packingLinesForOrder(order, products = []) {
  const resolve = packingProductResolver(products);
  const lines = new Map();
  for (const item of order?.items || []) {
    const product = stripGiftSuffix(item?.product ?? item?.name ?? '');
    if (!product) continue;
    // Same reading of qty as the Fulfillment card, so the two never disagree.
    const qty = Math.max(1, Math.floor(Number(item?.qty) || 1));
    const row = resolve(product);
    const key = productMatchKey(row) || `name:${normalize(product)}`;
    const line = lines.get(key);
    if (line) line.needed += qty;
    else lines.set(key, { key, product, catalogName: row?.product || null, needed: qty, scannable: Boolean(row) });
  }
  return [...lines.values()];
}

/** Lines with how many have been checked so far, and whether the box is done. */
export function packingProgress(lines, entries) {
  const counts = new Map();
  for (const entry of entries || []) counts.set(entry?.key, (counts.get(entry?.key) || 0) + 1);
  const withCounts = (lines || []).map((line) => ({
    ...line,
    packed: Math.min(counts.get(line.key) || 0, line.needed),
  }));
  return {
    lines: withCounts,
    packed: withCounts.reduce((sum, line) => sum + line.packed, 0),
    needed: withCounts.reduce((sum, line) => sum + line.needed, 0),
    complete: withCounts.length > 0 && withCounts.every((line) => line.packed >= line.needed),
  };
}

/**
 * Would one more item with this match key be right for this order?
 *   { ok: true, line }                         - tick it
 *   { ok: false, reason: 'not_in_order' }      - wrong product or wrong size
 *   { ok: false, reason: 'already_complete' }  - one too many of this product
 */
export function checkScan(lines, entries, key) {
  const line = key ? (lines || []).find((candidate) => candidate.key === key) : null;
  if (!line) return { ok: false, reason: 'not_in_order' };
  const already = (entries || []).filter((entry) => entry?.key === key).length;
  if (already >= line.needed) return { ok: false, reason: 'already_complete', line };
  return { ok: true, line };
}

/** The saved packing record: one row per product + batch + how it was checked. */
export function packedItemsFromEntries(entries) {
  const rows = new Map();
  for (const entry of entries || []) {
    const method = entry?.method === 'manual' ? 'manual' : 'scan';
    const batchCode = method === 'scan' ? String(entry?.code || '').toUpperCase() || null : null;
    const id = `${entry?.key}|${batchCode || ''}|${method}`;
    const row = rows.get(id);
    if (row) row.qty += 1;
    else {
      rows.set(id, {
        product: entry?.product || '',
        batch_code: batchCode,
        batch_id: method === 'scan' ? entry?.batchId || null : null,
        qty: 1,
        method,
      });
    }
  }
  return [...rows.values()];
}

/**
 * Re-check a whole packing session on the server.
 *
 * `entries` come from the browser: { method: 'scan', code } or
 * { method: 'manual', key }. `batchesByCode` maps each sticker code to its
 * product row ({ id, product_id, product }) as the database has it. What a
 * scanned sticker IS always comes from the database, never from the browser.
 */
export function verifyPackingEntries(order, entries, batchesByCode, products) {
  const lines = packingLinesForOrder(order, products);
  if (lines.length === 0) return { ok: false, error: 'This order has no items to pack.' };
  const accepted = [];
  for (const raw of entries || []) {
    let key;
    let entry;
    let label;
    if (raw?.method === 'manual') {
      key = String(raw?.key || '');
      label = lines.find((line) => line.key === key)?.product || 'That item';
      entry = { method: 'manual' };
    } else {
      const code = String(raw?.code || '').toUpperCase();
      const batch = batchesByCode.get(code);
      if (!batch) return { ok: false, error: `Sticker ${code || '(blank)'} is not a known batch.` };
      key = productMatchKey({ id: batch.product_id, product: batch.product });
      label = batch.product || code;
      entry = { method: 'scan', code, batchId: batch.id };
    }
    const verdict = checkScan(lines, accepted, key);
    if (!verdict.ok) {
      return {
        ok: false,
        error: verdict.reason === 'not_in_order'
          ? `${label} is not in this order.`
          : `Too many ${label} for this order.`,
      };
    }
    // Keep the order's own spelling, so the record reads like the order.
    accepted.push({ ...entry, key, product: verdict.line.product });
  }
  const progress = packingProgress(lines, accepted);
  if (!progress.complete) {
    return { ok: false, error: `Only ${progress.packed} of ${progress.needed} items are checked.` };
  }
  return { ok: true, packedItems: packedItemsFromEntries(accepted) };
}
