import assert from 'node:assert/strict';
import { test } from 'node:test';
import { relayFor } from '../lib/site/catalog-relay.mjs';
import { promoFromReply, promoFromUrl, promoOrderFields, validatePromo } from '../lib/site/promo.mjs';
import { isContactable, scanFromUrl } from '../lib/site/crm.mjs';
import { quoteCart, usablePromo } from '../lib/site/quote.mjs';
import { listViewData } from '../lib/site/analytics.mjs';

const RATE = 450;
const line = (product, qty, priceUsd = 100) => ({ product, qty, priceUsd, priceCrc: priceUsd * RATE, name: product, size: '10 mg' });

// ── The relay ───────────────────────────────────────────────────────────────

test('only the named catalog endpoints are relayed', () => {
  for (const name of ['promo-validate', 'cart-track', 'newsletter', 'referral-scan', 'whatsapp-optin']) {
    assert.ok(relayFor(name), name);
  }
  for (const name of ['admin', 'orders-create', '__proto__', 'constructor', '../promo/validate']) {
    assert.equal(relayFor(name), null, name);
  }
});

test('cart tracking may save or clear, never read another shopper\'s cart', () => {
  const { body } = relayFor('cart-track');
  assert.equal(body({ action: 'recover', sessionId: 'web-12345678' }), null);
  assert.equal(body({ action: 'clear', sessionId: 'web-12345678' }).action, 'clear');
  const saved = body({ action: 'save', sessionId: 'web-12345678', cart: [line('BPC-157 10mg', 3)], customerName: 'Omer Test' });
  assert.equal(saved.cart[0].product, 'BPC-157 10mg');
  assert.equal(saved.cart[0].qty, 3);
  assert.equal(saved.cart[0].quantity, 3, 'the recovery message reads `quantity`');
});

test('the promo reply keeps the commission rate on the server', () => {
  const reply = relayFor('promo-validate').reply({ valid: true, code: 'ZIGGY', discount_pct: 0.1, affiliate_id: 'a1', commission_rate: 0.12 });
  assert.equal(reply.code, 'ZIGGY');
  assert.equal(reply.affiliate_id, 'a1');
  assert.equal('commission_rate' in reply, false);
});

test('newsletter needs an email address', () => {
  const { body } = relayFor('newsletter');
  assert.equal(body({ email: 'nope' }), null);
  assert.deepEqual(body({ email: ' a@b.co ' }), { email: 'a@b.co' });
});

// ── Promo codes ─────────────────────────────────────────────────────────────

test('a code is read off an affiliate link the way the catalog reads it', () => {
  assert.equal(promoFromUrl('?promo=ZIGGY'), 'ZIGGY');
  assert.equal(promoFromUrl('?utm_source=x&promo_code=JEANPAUL'), 'JEANPAUL');
  assert.equal(promoFromUrl('?coupon=X1'), 'X1');
  assert.equal(promoFromUrl('?utm_source=x'), '');
});

test('the order carries the code and its affiliate, as the catalog posts them', () => {
  const promo = promoFromReply({ code: 'ziggy', discount_pct: 0.1, affiliate_id: 'a1' });
  assert.deepEqual(promoOrderFields(promo), { promo_code: 'ZIGGY', affiliate_id: 'a1' });
  assert.deepEqual(promoOrderFields(null), {});
});

test('a code with a minimum prices nothing until the cart reaches it', () => {
  const promo = promoFromReply({ code: 'BULK', discount_pct: 0.25, min_units: 10 });
  assert.equal(usablePromo(promo, [line('BPC-157 10mg', 4)]), null);
  assert.equal(usablePromo(promo, [line('BPC-157 10mg', 10)]), promo);
});

test('the quote prices a code with checkout\'s own function', () => {
  const cart = [line('BPC-157 10mg', 1)];
  const plain = quoteCart(cart, { currency: 'USD', exchangeRate: RATE });
  const coded = quoteCart(cart, { currency: 'USD', exchangeRate: RATE, promo: promoFromReply({ code: 'ZIGGY', discount_pct: 0.1 }) });
  assert.equal(plain.promoDiscount, 0);
  assert.ok(coded.promoApplied);
  assert.ok(coded.promoDiscount > 0);
  assert.ok(coded.total < plain.total);
});

test('a failed check reads as invalid, never throws', async () => {
  const reply = await validatePromo('X', { lang: 'en' }, async () => { throw new Error('offline'); });
  assert.equal(reply.valid, false);
  assert.ok(reply.error);
});

// ── CRM tracking ────────────────────────────────────────────────────────────

test('a cart is tracked only once the shopper can be contacted', () => {
  assert.equal(isContactable({}), false);
  assert.equal(isContactable({ phone: '8000' }), false);
  assert.equal(isContactable({ phone: '8000 0000' }), true);
  assert.equal(isContactable({ name: 'Omer Test' }), true);
  assert.equal(isContactable({ email: 'omer.test@example.com' }), true);
});

test('a landing is a scan only when it carries an agent, code or referral', () => {
  assert.equal(scanFromUrl('?utm_source=google'), null);
  assert.equal(scanFromUrl('?sales_agent=Maria').salesAgent, 'Maria');
  assert.equal(scanFromUrl('?promo=ZIGGY&utm_campaign=qr').promoCode, 'ZIGGY');
  assert.equal(scanFromUrl('?ref=joe').referral, 'joe');
});

// ── GA4 ─────────────────────────────────────────────────────────────────────

test('view_item_list in the catalog\'s shape', () => {
  const data = listViewData([
    { name: 'BPC-157', category: 'Tissue Repair', variants: [{ size: '5 mg', priceUsd: 60 }, { size: '10 mg', priceUsd: 90, isDefault: true }] },
  ], 'Shop');
  assert.equal(data.item_list_name, 'Shop');
  assert.equal(data.item_list_id, 'shop');
  assert.deepEqual(data.items[0], {
    item_id: 'bpc-157-10mg', item_name: 'BPC-157', item_variant: '10 mg', item_category: 'Tissue Repair',
    price: 90, index: 1, item_list_id: 'shop', item_list_name: 'Shop',
  });
});
