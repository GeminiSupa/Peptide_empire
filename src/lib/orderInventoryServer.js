import { stripGiftSuffix } from './bacWater.mjs';
import { productNameResolver } from './authoritativeCheckout.mjs';
import { nextOffsiteAfterStockChange, offsiteOf } from './offsiteInventory.mjs';
import { writeDroppingMissingColumns } from './optionalColumns.mjs';

const OFFSITE_OPTIONAL = ['offsite_inventory_count'];

// Lines are keyed by the catalog's current spelling when one is known, so an
// order saved before a product rename releases its stock from the same row it
// deducts from.
function quantities(lines = [], findProduct = () => null) {
  const byProduct = new Map();
  for (const line of lines || []) {
    const name = stripGiftSuffix(line?.product || line?.name);
    const product = findProduct(name)?.product || name;
    const qty = Math.max(0, Math.floor(Number(line?.qty ?? line?.quantity ?? 0)));
    if (!product || !qty) continue;
    byProduct.set(product, (byProduct.get(product) || 0) + qty);
  }
  return byProduct;
}

export function inventoryReservationPlan(currentLines = [], desiredItems = [], products = []) {
  const findProduct = productNameResolver(products);
  const current = quantities(currentLines, findProduct);
  const desired = quantities(desiredItems, findProduct);
  const productByName = new Map((products || []).map((row) => [row.product, row]));
  const changes = [];
  const reservations = [];

  for (const product of new Set([...current.keys(), ...desired.keys()])) {
    const row = productByName.get(product);
    const currentQty = current.get(product) || 0;
    const desiredQty = desired.get(product) || 0;
    if (!row || row.inventory_count === null || row.inventory_count === undefined) continue;

    const stockNow = Number(row.inventory_count || 0);
    const availableForOrder = stockNow + currentQty;
    if (desiredQty > availableForOrder) {
      return { ok: false, error: `${product}: only ${availableForOrder} available` };
    }
    const nextInventory = availableForOrder - desiredQty;
    const offsiteBefore = offsiteOf(row);
    const offsitePlan = nextOffsiteAfterStockChange(stockNow, nextInventory, offsiteBefore);
    changes.push({
      product,
      before: stockNow,
      after: nextInventory,
      offsiteBefore,
      offsiteAfter: offsitePlan.after,
      offsiteShortfall: offsitePlan.shortfall,
      threshold: row.low_stock_threshold === null || row.low_stock_threshold === undefined
        ? 5
        : Number(row.low_stock_threshold),
    });
    if (desiredQty > 0) reservations.push({ product, qty: desiredQty });
  }

  return { ok: true, changes, reservations };
}

async function applyInventoryChanges(supabase, changes, direction = 'forward') {
  const applied = [];
  for (const change of changes) {
    const value = direction === 'forward' ? change.after : change.before;
    const offsiteValue = direction === 'forward' ? change.offsiteAfter : change.offsiteBefore;
    const payload = { inventory_count: value };
    if (offsiteValue !== undefined && offsiteValue !== null) {
      payload.offsite_inventory_count = offsiteValue;
    }
    const { error } = await writeDroppingMissingColumns(
      payload,
      OFFSITE_OPTIONAL,
      (row) => supabase.from('products').update(row).eq('product', change.product),
    );
    if (error) {
      if (direction === 'forward' && applied.length > 0) {
        await applyInventoryChanges(supabase, applied.reverse(), 'rollback');
      }
      throw error;
    }
    applied.push(change);
  }
}

export async function prepareInventoryReservation(supabase, currentLines, desiredItems) {
  const hasLines = quantities(currentLines).size > 0 || quantities(desiredItems).size > 0;
  if (!hasLines) {
    return { reservations: [], changes: [], rollback: async () => {} };
  }

  // The whole catalog, not .in(names): an old order may spell a product the
  // way it was named before a rename, which an exact-name filter would miss.
  const { data, error } = await supabase
    .from('products')
    .select('product,inventory_count,offsite_inventory_count,low_stock_threshold');
  if (error) throw error;

  const plan = inventoryReservationPlan(currentLines, desiredItems, data || []);
  if (!plan.ok) {
    const shortage = new Error(plan.error);
    shortage.status = 409;
    throw shortage;
  }

  await applyInventoryChanges(supabase, plan.changes);
  return {
    ...plan,
    rollback: () => applyInventoryChanges(supabase, [...plan.changes].reverse(), 'rollback'),
  };
}

export async function notifyLowInventory(supabase, changes = []) {
  for (const change of changes) {
    const crossed = change.before > change.threshold && change.after <= change.threshold;
    const hitZero = change.before > 0 && change.after === 0;
    if (crossed || hitZero) {
      await supabase.from('admin_notifications').insert({
        type: 'low_inventory',
        title: hitZero ? `Out of Stock: ${change.product}` : `Low Stock Alert: ${change.product}`,
        body: `Inventory has dropped to ${change.after} unit(s).`,
        link_tab: 'spreadsheet',
      });
    }
    // He packed more than we had logged with him — total still fell; off-site
    // needs a top-up so the tab matches what is really left out there.
    if (Number(change.offsiteShortfall || 0) > 0) {
      await supabase.from('admin_notifications').insert({
        type: 'offsite_inventory_short',
        title: `Off-site short: ${change.product}`,
        body: `An order used ${change.offsiteShortfall} more vial(s) than were logged off site. Give him more stock in Off-site stock.`,
        link_tab: 'offsite_inventory',
      });
    }
  }
}

/**
 * Take a paid order's vials out of stock, once.
 *
 * This body used to live inside /api/chargx/process-card, which was the
 * only place that could learn a card order had been paid: it charged the card
 * itself and deducted in the same request. With the ChargX hand-off the answer
 * arrives at /api/chargx/webhook instead, long after the customer has left the
 * site — so the deduction has to happen there too, and one copy serves both.
 *
 * Never throws. A payment that cleared must not be reported as failed because
 * a stock row could not be written; a failure raises a dashboard alert and the
 * caller carries on.
 */
export async function reservePaidOrderInventory(supabase, order, { logPrefix = '[Paid inventory]' } = {}) {
  // New public orders explicitly start with an empty reservation. Legacy rows
  // without the column were already deducted by the old create route and must
  // never be deducted a second time. A row that already carries a reservation
  // has been through here, or through the admin panel, and is left alone —
  // which is also what makes a repeated webhook delivery harmless.
  if (!Array.isArray(order?.inventory_deducted) || order.inventory_deducted.length > 0) {
    return { reserved: false, skipped: 'already-reserved' };
  }

  let reservation = null;
  try {
    reservation = await prepareInventoryReservation(supabase, [], order.items || []);
    const { error } = await supabase
      .from('orders')
      .update({ inventory_deducted: reservation.reservations })
      .eq('id', order.id);
    if (error) {
      await reservation.rollback().catch(() => {});
      reservation = null;
      throw error;
    }
    try {
      await notifyLowInventory(supabase, reservation.changes);
    } catch (notifyError) {
      console.error(`${logPrefix} Low inventory notification failed:`, notifyError.message);
    }
    return { reserved: true, changes: reservation.changes, reservations: reservation.reservations };
  } catch (error) {
    console.error(`${logPrefix} Paid-order inventory reservation failed for ${order?.order_number}:`, error.message);
    try {
      await supabase.from('admin_notifications').insert({
        type: 'inventory_reservation_failed',
        title: `Inventory review required: ${order?.order_number}`,
        body: `Payment was approved but stock could not be reserved: ${error.message}`.slice(0, 500),
        link_tab: 'orders',
        link_ref: order?.order_number,
      });
    } catch {
      // The payment result still has to be returned even if the alert fails.
    }
    return { reserved: false, error: error.message };
  }
}
