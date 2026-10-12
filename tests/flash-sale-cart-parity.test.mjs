import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDealOffer, freeVialLine } from '../src/lib/dealOffers.mjs';
import { isBacWater, isGiftLine, stripGiftSuffix, summarizeBacWater } from '../src/lib/bacWater.mjs';
import { getVolumeDiscountPct } from '../src/lib/pricing.js';
import { buildCheckoutBreakdown } from '../src/lib/checkoutBreakdown.mjs';
import { authoritativeCheckout } from '../src/lib/authoritativeCheckout.mjs';

/**
 * The catalog computes the total in the browser and the server computes it
 * again before saving. They are separate implementations of the same rules, so
 * a rule added to one and not the other shows the customer one price and
 * charges another. That is exactly what happened when flash sales shipped: the
 * card read $35, the checkout button read full price.
 *
 * These mirror the browser's getPromoDiscountAmount / getEffectiveVolumePct.
 */
const browserVolumePct = (offer, tierPct) => (
  offer ? (offer.kind !== 'volume' && offer.kind !== 'none' ? 0 : tierPct) : tierPct
);
const browserPromoDiscount = (offer, currency, discountableSubtotal, bacCharge = 0) => {
  if (!offer) return 0;
  if (offer.kind === 'flat' || offer.kind === 'pair') {
    const flat = Math.max(0, Number(offer.savings) || 0);
    return currency === 'USD' ? Math.round(flat * 100) / 100 : Math.round(flat);
  }
  if (offer.kind !== 'mix') return 0;
  const winningPct = Number(offer.offer?.discount_pct ?? offer.mix.discountPct) || 0;
  const base = (discountableSubtotal + bacCharge) * winningPct;
  return currency === 'USD' ? Math.round(base * 100) / 100 : Math.round(base);
};

const GHK = 'GHK-CU 50mg';
const TIRZ = 'Tirzepatide 20mg';
const products = [
  { id: '1', product: GHK, price_usd: '$70', price_crc: '31407', status: 'In Stock', inventory_count: 18 },
  { id: '2', product: TIRZ, price_usd: '$200', price_crc: '89734', status: 'In Stock', inventory_count: 50 },
];
const offers = { items: [
  { id: 'flash', type: 'flat', enabled: true, product_names: [GHK], discount_pct: 0.50 },
  { id: 'mix', type: 'mix', enabled: true, product_names: [GHK, TIRZ], min_units: 2, discount_pct: 0.10 },
] };

const carts = [
  [{ product: GHK, qty: 1 }],
  [{ product: GHK, qty: 2 }],
  [{ product: GHK, qty: 1 }, { product: TIRZ, qty: 1 }],
  [{ product: GHK, qty: 1 }, { product: TIRZ, qty: 3 }],
  [{ product: TIRZ, qty: 2 }],
];

for (const currency of ['USD', 'CRC']) {
  for (const items of carts) {
    const label = `${currency}: ${items.map((i) => `${i.qty}x ${i.product}`).join(' + ')}`;
    test(`browser and server agree on the discount — ${label}`, () => {
      const server = authoritativeCheckout({
        postedOrder: { currency, items, lang: 'en' },
        products, exchangeRate: 448.67, dealOffers: offers,
      });
      assert.equal(server.ok, true);

      const lines = items.map((item) => {
        const row = products.find((p) => p.product === item.product);
        const unitPrice = currency === 'USD'
          ? Number(String(row.price_usd).replace(/[^0-9.]/g, ''))
          : Number(String(row.price_crc).replace(/[^0-9.]/g, ''));
        return { product: item.product, qty: item.qty, unitPrice, inventoryCount: row.inventory_count };
      });
      const offer = chooseDealOffer(offers, lines, { volumePct: 0, bacCharge: 0 });

      const discountableSubtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
      assert.equal(browserPromoDiscount(offer, currency, discountableSubtotal), server.promoDiscount, 'discount must match');
      assert.equal(browserVolumePct(offer, 0), server.volumeDiscountPct, 'volume tier must match');
    });
  }
}

test('a flash sale shows its saving on the invoice breakdown', () => {
  const lines = [{ product: GHK, qty: 1, unitPrice: 70 }];
  const choice = chooseDealOffer(offers, lines, {});
  const breakdown = buildCheckoutBreakdown({ lines, dealChoice: choice });
  assert.equal(choice.kind, 'flat');
  assert.equal(breakdown.discountAmount, 35, 'the invoice must not show a zero saving');
  assert.equal(breakdown.discountPct, 0.50);
});

test('the order summary numbers add up on their own', () => {
  // The summary printed goods + shipping and then a smaller total, with no
  // line accounting for the difference. Whatever is shown must reconcile.
  for (const items of [
    [{ product: GHK, qty: 1 }],
    [{ product: GHK, qty: 2 }],
    [{ product: GHK, qty: 2 }, { product: TIRZ, qty: 1 }],
  ]) {
    const server = authoritativeCheckout({
      postedOrder: { currency: 'USD', items, lang: 'en' },
      products, exchangeRate: 448.67, dealOffers: offers,
    });
    const shown = server.subtotal - server.volumeDiscountAmount - server.promoDiscount + server.shipping;
    assert.equal(
      Math.round(shown * 100) / 100,
      server.total,
      `subtotal ${server.subtotal} - discounts (${server.volumeDiscountAmount} + ${server.promoDiscount}) + shipping ${server.shipping} must equal ${server.total}`,
    );
    assert.ok(server.promoDiscount > 0, 'a flash sale cart must show a discount, not a silent gap');
  }
});

const pairOffers = { items: [
  { id: 'pair', type: 'pair', enabled: true, product_names: [GHK, TIRZ], discount_pct: 0.50 },
] };
const pairCarts = [
  [{ product: GHK, qty: 1 }],
  [{ product: GHK, qty: 2 }],
  [{ product: GHK, qty: 1 }, { product: TIRZ, qty: 1 }],
  [{ product: GHK, qty: 2 }, { product: TIRZ, qty: 1 }],
  [{ product: TIRZ, qty: 4 }],
];

for (const currency of ['USD', 'CRC']) {
  for (const items of pairCarts) {
    const label = `${currency}: ${items.map((i) => `${i.qty}x ${i.product}`).join(' + ')}`;
    test(`browser and server agree on the 2nd-vial discount — ${label}`, () => {
      const server = authoritativeCheckout({
        postedOrder: { currency, items, lang: 'en' },
        products, exchangeRate: 448.67, dealOffers: pairOffers,
      });
      assert.equal(server.ok, true);

      const lines = items.map((item) => {
        const row = products.find((p) => p.product === item.product);
        const unitPrice = currency === 'USD'
          ? Number(String(row.price_usd).replace(/[^0-9.]/g, ''))
          : Number(String(row.price_crc).replace(/[^0-9.]/g, ''));
        return { product: item.product, qty: item.qty, unitPrice, inventoryCount: row.inventory_count };
      });
      const offer = chooseDealOffer(pairOffers, lines, { volumePct: 0, bacCharge: 0 });
      const discountableSubtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
      assert.equal(browserPromoDiscount(offer, currency, discountableSubtotal), server.promoDiscount, 'discount must match');
      assert.equal(browserVolumePct(offer, 0), server.volumeDiscountPct, 'volume tier must match');
      const shown = server.subtotal - server.volumeDiscountAmount - server.promoDiscount + server.shipping;
      assert.equal(Math.round(shown * 100) / 100, server.total);
    });
  }
}

// A capped Buy/Get-Free offer. The free vials are gift lines rather than a
// money discount, so parity here means the browser and the server hand the
// customer the same free vials — and that the cap trims both the same way.
const BPC = 'BPC-157 10mg';
const cappedProducts = [
  ...products,
  { id: '3', product: BPC, price_usd: '$40', price_crc: '17947', status: 'In Stock', inventory_count: 100 },
];
const cappedOffers = { items: [
  { id: 'b3', type: 'bundle', enabled: true, product_names: [GHK, TIRZ, BPC], buy_qty: 3, free_qty: 1, max_free_qty: 2 },
  { id: 'b5', type: 'bundle', enabled: true, product_names: [GHK, TIRZ, BPC], buy_qty: 5, free_qty: 2, max_free_qty: 2 },
] };
const cappedCarts = [
  [{ product: GHK, qty: 3 }],
  [{ product: GHK, qty: 5 }],
  [{ product: GHK, qty: 12 }],
  [{ product: GHK, qty: 6 }, { product: TIRZ, qty: 6 }],
  [{ product: GHK, qty: 3 }, { product: TIRZ, qty: 3 }, { product: BPC, qty: 3 }],
  [{ product: GHK, qty: 9 }, { product: TIRZ, qty: 9 }, { product: BPC, qty: 9 }],
];

for (const currency of ['USD', 'CRC']) {
  for (const items of cappedCarts) {
    const label = `${currency}: ${items.map((i) => `${i.qty}x ${i.product}`).join(' + ')}`;
    test(`browser and server hand over the same capped free vials — ${label}`, () => {
      const server = authoritativeCheckout({
        postedOrder: { currency, items, lang: 'en' },
        products: cappedProducts, exchangeRate: 448.67, dealOffers: cappedOffers,
      });
      assert.equal(server.ok, true);

      const lines = items.map((item) => {
        const row = cappedProducts.find((p) => p.product === item.product);
        const unitPrice = currency === 'USD'
          ? Number(String(row.price_usd).replace(/[^0-9.]/g, ''))
          : Number(String(row.price_crc).replace(/[^0-9.]/g, ''));
        return { product: item.product, qty: item.qty, unitPrice, inventoryCount: row.inventory_count };
      });
      // The server scores the bundle against the standard volume tier, so the
      // browser side has to see the same tier or the comparison is rigged.
      const vialCount = lines.filter((l) => !isBacWater(l.product)).reduce((sum, l) => sum + l.qty, 0);
      const tierPct = getVolumeDiscountPct(vialCount);
      const bacCharge = summarizeBacWater(lines, currency, 448.67).charge;
      const offer = chooseDealOffer(cappedOffers, lines, { volumePct: tierPct, bacCharge });

      const browserFree = offer.kind === 'bundle'
        ? offer.bundle.freeLines.map((l) => freeVialLine(l.product, l.qty, 'en'))
        : [];
      // Every peptide order also carries free BAC water; only the bundle's own
      // free vials are what the two paths must agree on here.
      const serverFree = server.items
        .filter((item) => isGiftLine(item) && !isBacWater(stripGiftSuffix(item.product)));
      assert.deepEqual(
        serverFree.map((l) => ({ product: l.product, qty: l.qty })),
        browserFree.map((l) => ({ product: l.product, qty: l.qty })),
        'the free vials the cart promises must be the ones the server adds',
      );
      const freeCount = browserFree.reduce((n, l) => n + l.qty, 0);
      assert.ok(freeCount <= 2, `the cap must hold: ${freeCount} free vials went out`);
    });
  }
}

// The same carts again, with the bundle counting any mix of its products.
const mixOffers = { items: [
  { id: 'm3', type: 'bundle', enabled: true, count_mode: 'any_mix', product_names: [GHK, TIRZ, BPC], buy_qty: 3, free_qty: 1, max_free_qty: 2 },
] };

for (const currency of ['USD', 'CRC']) {
  for (const items of cappedCarts) {
    const label = `${currency}: ${items.map((i) => `${i.qty}x ${i.product}`).join(' + ')}`;
    test(`browser and server agree on a mix-and-match bundle — ${label}`, () => {
      const server = authoritativeCheckout({
        postedOrder: { currency, items, lang: 'en' },
        products: cappedProducts, exchangeRate: 448.67, dealOffers: mixOffers,
      });
      assert.equal(server.ok, true);

      const lines = items.map((item) => {
        const row = cappedProducts.find((p) => p.product === item.product);
        const unitPrice = currency === 'USD'
          ? Number(String(row.price_usd).replace(/[^0-9.]/g, ''))
          : Number(String(row.price_crc).replace(/[^0-9.]/g, ''));
        return { product: item.product, qty: item.qty, unitPrice, inventoryCount: row.inventory_count };
      });
      const vialCount = lines.filter((l) => !isBacWater(l.product)).reduce((sum, l) => sum + l.qty, 0);
      const bacCharge = summarizeBacWater(lines, currency, 448.67).charge;
      const offer = chooseDealOffer(mixOffers, lines, { volumePct: getVolumeDiscountPct(vialCount), bacCharge });

      const browserFree = offer.kind === 'bundle'
        ? offer.bundle.freeLines.map((l) => freeVialLine(l.product, l.qty, 'en'))
        : [];
      const serverFree = server.items
        .filter((item) => isGiftLine(item) && !isBacWater(stripGiftSuffix(item.product)));
      assert.deepEqual(
        serverFree.map((l) => ({ product: l.product, qty: l.qty })),
        browserFree.map((l) => ({ product: l.product, qty: l.qty })),
        'the free vials the cart promises must be the ones the server adds',
      );
      assert.ok(browserFree.reduce((n, l) => n + l.qty, 0) <= 2, 'the cap must hold under mix counting too');
    });
  }
}
