import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDetails, businessDiscountPct, findBusinessAccount } from '../src/lib/businessAccounts.mjs';
import { authoritativeCheckout } from '../src/lib/authoritativeCheckout.mjs';
import { buildBusinessAccountEmail } from '../src/lib/businessAccountEmail.mjs';

const product = { product: 'BPC-157 10mg', price_usd: '$100', price_crc: '₡45,000', status: 'In Stock', inventory_count: 100 };
const quote = (extra = {}) => authoritativeCheckout({ postedOrder: { currency: 'USD', items: [{ product: product.product, qty: 2 }] }, products: [product], exchangeRate: 450, ...extra });

test('business approval and finite valid terms are mandatory', () => {
  for (const status of ['pending', 'suspended', undefined]) assert.equal(businessDiscountPct({ status, discount_pct: 30 }), 0);
  for (const discount_pct of [-1, 101, 'bad', Infinity]) assert.equal(businessDiscountPct({ status: 'approved', discount_pct }), 0);
  assert.equal(businessDiscountPct({ status: 'approved', discount_pct: '20.50' }), 20.5);
});
test('business application normalizes corporation number and discards privileged fields', () => {
  const details = businessDetails({ legal_name: ' Company ', contact_name: 'Ana', phone: '123', billing_address: 'San José', corporation_number: '3-101-123456', discount_pct: 90, status: 'approved', email: 'other@example.com' });
  assert.equal(details.corporation_number, '3101123456');
  assert.equal(details.legal_name, 'Company');
  assert.equal(details.status, undefined);
  assert.equal(details.discount_pct, undefined);
  assert.equal(details.email, undefined);
  assert.throws(() => businessDetails({ corporation_number: '123' }));
});
test('business terms apply without a code and do not trust posted discounts', () => {
  const priced = quote({ businessDiscountPct: 20 });
  assert.equal(priced.businessApplied, true);
  assert.equal(priced.volumeDiscountPct, 20);
  assert.equal(priced.total, 160 + Number((2500 / 450).toFixed(2)));
  assert.equal(quote({ postedOrder: { currency: 'USD', businessDiscountPct: 90, items: [{ product: product.product, qty: 2 }] } }).businessApplied, false);
});
test('a better public promotion wins, and business pricing does not stack', () => {
  const promo = { discount_pct: 0.5 };
  const priced = quote({ businessDiscountPct: 20, promo });
  assert.equal(priced.businessApplied, false);
  assert.equal(priced.promoDiscount, 100);
  const businessWins = quote({ businessDiscountPct: 60, promo });
  assert.equal(businessWins.businessApplied, true);
  assert.equal(businessWins.promoDiscount, 0);
});

test('business pricing uses the same percentage and shipping in colones', () => {
  const priced = quote({ businessDiscountPct: 20, postedOrder: { currency: 'CRC', items: [{ product: product.product, qty: 2 }] } });
  assert.equal(priced.businessApplied, true);
  assert.equal(priced.total, 74500);
  assert.equal(priced.volumeDiscountAmount, 18000);
});

test('suspension removes negotiated pricing and preserves ordinary shopping', () => {
  const priced = quote({ businessDiscountPct: businessDiscountPct({ status: 'suspended', discount_pct: 50 }) });
  assert.equal(priced.businessApplied, false);
  assert.equal(priced.total, 200);
});

test('business lookup normalizes only its verified identity and propagates database failures', async () => {
  const calls = [];
  const admin = { from(table) { calls.push(table); return { select() { return this; }, eq(key, value) { calls.push([key, value]); return this; }, async maybeSingle() { return { data: { id: 'company' } }; } }; } };
  assert.equal((await findBusinessAccount(admin, ' Buyer@Example.com ')).id, 'company');
  assert.deepEqual(calls, ['business_accounts', ['email', 'buyer@example.com']]);
  assert.equal(await findBusinessAccount(admin, null), null);
  const failing = code => ({ from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { error: { code } }; } }; } });
  assert.equal(await findBusinessAccount(failing('42P01'), 'a@b.com'), null);
  await assert.rejects(() => findBusinessAccount(failing('08006'), 'a@b.com'), /temporarily unavailable/);
});

test('business emails escape company data and distinguish pending from approved', () => {
  const business = { legal_name: '<script>Company</script>', contact_name: 'Ana & Co', email: 'buyer@example.com', discount_pct: 20 };
  const invitation = buildBusinessAccountEmail(business, 'https://example.com/account/login');
  assert.match(invitation.html, /&lt;script&gt;Company/);
  assert.doesNotMatch(invitation.html, /<script>/);
  assert.match(invitation.html, /Ana &amp; Co/);
  assert.match(invitation.text, /20%/);
  assert.match(invitation.text, /verify the code/);
  const pending = buildBusinessAccountEmail(business, 'https://example.com/account/login', { application: true });
  assert.match(pending.text, /after approval/);
  assert.doesNotMatch(pending.text, /approved with a/);
});
