import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cartCount,
  freeDeliveryProgress,
  freeShippingThreshold,
  nextTier,
  totalsFor,
} from '../lib/storefront/cart-math.mjs';

const RATE = 454.48;

function line(product, priceUsd, qty) {
  return { product, priceUsd, priceCrc: Math.round(priceUsd * RATE), qty };
}

test('no discount under five vials, 15% at five, 20% at ten', () => {
  const four = totalsFor([line('BPC-157 10mg', 90, 4)], 'USD', RATE);
  assert.equal(four.discountPct, 0);
  assert.equal(four.discountAmount, 0);

  const five = totalsFor([line('BPC-157 10mg', 90, 5)], 'USD', RATE);
  assert.equal(five.discountPct, 15);
  // The catalog rounds the DISCOUNTED TOTAL, not the discount: $450 becomes
  // round(450 × 0.85) = 383, so the saving is 67 rather than round(450 × 0.15)
  // = 68. A penny either way, but it is checkout's penny — computing it the
  // other way here would show a total checkout then refuses.
  assert.equal(five.discountedTotal, 383);
  assert.equal(five.discountAmount, 67);

  const ten = totalsFor([line('BPC-157 10mg', 90, 10)], 'USD', RATE);
  assert.equal(ten.discountPct, 20);
});

test('the next-tier nudge counts the vials still needed', () => {
  assert.deepEqual(nextTier([line('BPC-157 10mg', 90, 4)]), { at: 5, pct: 15, add: 1 });
  assert.deepEqual(nextTier([line('BPC-157 10mg', 90, 5)]), { at: 10, pct: 20, add: 5 });
  assert.equal(nextTier([line('BPC-157 10mg', 90, 10)]), null, 'no nudge once the best tier is reached');
});

test('BAC water never earns a tier and is never discounted', () => {
  // Six vials of water plus one peptide is seven items but one discountable
  // vial, so the cart is still four short of the first tier.
  const cart = [line('BPC-157 10mg', 90, 1), line('BAC Water 3ml', 10, 6)];
  const totals = totalsFor(cart, 'USD', RATE);

  assert.equal(cartCount(cart), 7);
  assert.equal(totals.discountPct, 0);
  assert.equal(totals.bacCharge, 60);
  assert.deepEqual(nextTier(cart), { at: 5, pct: 15, add: 4 });

  // At the tier, the discount applies to the peptides only.
  const bulk = totalsFor([line('BPC-157 10mg', 90, 5), line('BAC Water 3ml', 10, 2)], 'USD', RATE);
  assert.equal(bulk.discountPct, 15);
  assert.equal(bulk.discountAmount, 67, 'the discount is taken on the $450 of peptides alone');
  assert.equal(bulk.bacCharge, 20);
  assert.equal(bulk.discountedTotal, 383 + 20, 'the water is added after, undiscounted');
});

test('free delivery is $200, converted — not a fixed colón figure', () => {
  assert.equal(freeShippingThreshold('USD', RATE), 200);
  assert.equal(freeShippingThreshold('CRC', RATE), Math.round(200 * RATE));
  // Which is where the design's "₡90,896" comes from.
  assert.equal(freeShippingThreshold('CRC', 454.48), 90896);
  // A different rate moves it, as it must.
  assert.equal(freeShippingThreshold('CRC', 500), 100000);
});

test('delivery charged under the threshold, free at or above it', () => {
  const under = totalsFor([line('BPC-157 10mg', 90, 1)], 'USD', RATE);
  assert.ok(under.shipping > 0);

  const over = totalsFor([line('Tirzepatide 60mg', 283, 1)], 'USD', RATE);
  assert.equal(over.shipping, 0);
  assert.equal(over.total, 283);
});

test('progress is measured on the discounted total, which is what the rule tests', () => {
  // Five vials at $45 is $225 before the discount and $191.25 after — under
  // the threshold, so delivery is still charged. Measuring the pre-discount
  // subtotal would promise free delivery the order does not get.
  const cart = [line('Selank 10mg', 45, 5)];
  const totals = totalsFor(cart, 'USD', RATE);
  const progress = freeDeliveryProgress(cart, 'USD', RATE);

  assert.equal(totals.discountedTotal, 191, 'rounded by the catalog\'s own arithmetic');
  assert.ok(totals.shipping > 0);
  assert.equal(progress.reached, false);
  assert.equal(progress.remaining, 200 - 191);
  assert.ok(progress.percent > 90 && progress.percent < 100);
});

test('an empty cart is not "free delivery unlocked"', () => {
  const progress = freeDeliveryProgress([], 'CRC', RATE);
  assert.equal(progress.reached, false);
  assert.equal(progress.percent, 0);
  assert.equal(cartCount([]), 0);
});
