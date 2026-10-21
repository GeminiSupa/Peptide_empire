/**
 * Off-site stock: the pile sitting with the packing ops person.
 *
 * inventory_count = everything the business owns.
 * offsite_inventory_count = subset stored off site.
 * on-site = total - offsite.
 *
 * Pure helpers so the admin tab, order deduction and restores share one rule.
 */

const asInt = (value, fallback = 0) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

export function offsiteOf(product) {
  if (product?.offsite_inventory_count === null || product?.offsite_inventory_count === undefined) {
    return 0;
  }
  return Math.max(0, asInt(product.offsite_inventory_count, 0));
}

export function totalOf(product) {
  if (product?.inventory_count === null || product?.inventory_count === undefined) return null;
  return Math.max(0, asInt(product.inventory_count, 0));
}

/** Vials still with us, not with the off-site packer. */
export function onSiteOf(product) {
  const total = totalOf(product);
  if (total === null) return null;
  return Math.max(0, total - offsiteOf(product));
}

/**
 * Hand vials to the off-site packer (or take them back).
 * Total owned does not change — only where they sit.
 */
export function planOffsiteTransfer(product, { qty, direction }) {
  const amount = Math.max(0, asInt(qty, 0));
  if (!amount) return { ok: false, error: 'Enter how many vials to move.' };

  const total = totalOf(product);
  if (total === null) {
    return { ok: false, error: `${product?.product || 'Product'} has no tracked inventory.` };
  }

  const offsite = offsiteOf(product);
  if (direction === 'to_offsite') {
    const onSite = total - offsite;
    if (amount > onSite) {
      return {
        ok: false,
        error: `Only ${onSite} vial(s) are on site to give him (${product?.product || 'product'}).`,
      };
    }
    return {
      ok: true,
      product: product.product,
      before: offsite,
      after: offsite + amount,
      total,
      direction,
      qty: amount,
    };
  }

  if (direction === 'from_offsite') {
    if (amount > offsite) {
      return {
        ok: false,
        error: `He only holds ${offsite} vial(s) of ${product?.product || 'product'}.`,
      };
    }
    return {
      ok: true,
      product: product.product,
      before: offsite,
      after: offsite - amount,
      total,
      direction,
      qty: amount,
    };
  }

  return { ok: false, error: 'Direction must be to_offsite or from_offsite.' };
}

/**
 * When main stock moves because of an order, off-site moves by the same delta
 * (clamped at zero). A shortfall means he packed more than we had logged with him.
 *
 * @param {number} stockBefore main inventory before the change
 * @param {number} stockAfter  main inventory after the change
 * @param {number} offsiteBefore
 */
export function nextOffsiteAfterStockChange(stockBefore, stockAfter, offsiteBefore) {
  const delta = asInt(stockAfter, 0) - asInt(stockBefore, 0);
  const before = Math.max(0, asInt(offsiteBefore, 0));
  const after = Math.max(0, before + delta);
  const shortfall = delta < 0 ? Math.max(0, -delta - before) : 0;
  return { after, shortfall, delta };
}

/** Rows for the Off-site stock tab. */
export function summariseOffsiteStock(products = []) {
  return (products || [])
    .filter((row) => totalOf(row) !== null)
    .map((row) => {
      const total = totalOf(row);
      const offsite = offsiteOf(row);
      return {
        id: row.id,
        product: row.product,
        status: row.status || '',
        total,
        offsite,
        onSite: Math.max(0, total - offsite),
        low: offsite <= 0 && total > 0,
      };
    })
    .sort((a, b) => {
      if (a.low !== b.low) return a.low ? -1 : 1;
      return String(a.product).localeCompare(String(b.product));
    });
}
