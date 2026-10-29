import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDetails, businessDiscountPct, businessLanguageFor, findBusinessAccount } from '../src/lib/businessAccounts.mjs';
import { authoritativeCheckout } from '../src/lib/authoritativeCheckout.mjs';
import { buildBusinessAccountEmail, buildBusinessQuoteRequestEmail, buildBusinessQuoteReviewEmail, buildBusinessTermsEmail, businessEmailAttachments } from '../src/lib/businessAccountEmail.mjs';
import { buildSignInCodeEmail } from '../src/lib/accountSignInCode.mjs';
import { businessFacingName } from '../src/lib/catalogCategories.mjs';

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
  const business = { legal_name: '<script>Company</script>', contact_name: 'Ana & Co', email: 'buyer@example.com', discount_pct: 20, corporation_number: '3101123456', phone: '8888-0000', billing_address: 'San José', delivery_address: '' };
  const welcome = buildBusinessAccountEmail(business, 'https://example.com');
  assert.match(welcome.html, /&lt;script&gt;Company/);
  assert.doesNotMatch(welcome.html, /<script>/);
  assert.match(welcome.subject, /aprobada/);
  assert.match(welcome.text, /20%/);
  const pending = buildBusinessAccountEmail(business, 'https://example.com', { application: true });
  assert.match(pending.html, /Ana &amp; Co/);
  assert.match(pending.text, /después de la aprobación/);
  assert.doesNotMatch(pending.subject, /aprobada/);
  assert.doesNotMatch(pending.text, /20%/);
});

test('the welcome email is in the business language only, with every saved detail', () => {
  const business = { legal_name: 'Lab SA', contact_name: 'Ana', email: 'buyer@example.com', discount_pct: 20, corporation_number: '3101123456', phone: '8888-0000', billing_address: 'Billing street', delivery_address: 'Delivery street', status: 'approved' };
  const spanish = buildBusinessAccountEmail(business, 'https://catalog.peptidescostarica.net');
  assert.match(spanish.html, /¡Su cuenta empresarial está aprobada!/);
  assert.doesNotMatch(spanish.html, /Your Business Account Is Approved/);
  const english = buildBusinessAccountEmail({ ...business, preferred_language: 'en' }, 'https://catalog.peptidescostarica.net');
  assert.equal(english.subject, 'Your Business Account Is Approved!');
  assert.doesNotMatch(english.html, /aprobada/);
  for (const value of ['20% OFF', 'No Minimum Order Quantity or Purchase Amount Required', 'Shop with Business Pricing', 'Chat with us on WhatsApp', '3101123456', 'Billing street', 'Delivery street', 'buyer@example.com', 'Business Accounts Team']) assert.ok(english.html.includes(value), value);
  // The orange button signs in and lands on the catalog in their language.
  assert.match(english.html, /account\/login\?lang=en&amp;next=%2Fcatalog%3Flang%3Den/);
  assert.match(english.html, /cid:peptides-costa-rica-logo/);
});

test('the welcome email only promises no minimum when there is none', () => {
  const business = { legal_name: 'Lab SA', email: 'b@example.com', discount_pct: 20, minimum_units: 10, minimum_order_usd: 500, preferred_language: 'en' };
  const letter = buildBusinessAccountEmail(business, 'https://example.com');
  assert.doesNotMatch(letter.html, /No Minimum Order Quantity/);
  assert.match(letter.html, /Minimum order: 10 units/);
  assert.match(letter.html, /US\$500\.00/);
});

test('quote and terms emails follow the business language and use the real compound name', () => {
  const business = { legal_name: 'Lab SA', preferred_language: 'en', discount_pct: 15, status: 'suspended', minimum_units: 0, minimum_order_usd: 0 };
  const quote = { id: 'abcdef12-0000', requested_by_email: 'buyer@example.com', items: [{ product: 'GLP-1 (RT) – Agonista Triple 30mg', qty: 3 }], customer_note: 'Need it Friday' };
  const received = buildBusinessQuoteRequestEmail(business, quote, 'https://example.com');
  assert.equal(received.subject, 'Quote request received');
  assert.match(received.html, /3 × Retatrutide 30mg/);
  assert.match(received.html, /ABCDEF12/);
  assert.match(received.html, /Need it Friday/);
  const ready = buildBusinessQuoteReviewEmail(business, { ...quote, status: 'approved', expires_at: '2026-11-01T05:59:00Z', items: [{ ...quote.items[0], unit_price_usd: 40 }] }, 'https://example.com');
  assert.match(ready.html, /Retatrutide 30mg · US\$40\.00 per unit/);
  assert.match(ready.html, /31\/10\/2026, 23:59 \(CR\)/);
  const terms = buildBusinessTermsEmail({ ...business, preferred_language: 'es' }, 'https://example.com');
  assert.match(terms.html, /En pausa/);
  assert.match(terms.html, /15%/);
});

test('the business dashboard name for GLP-1 is Retatrutide, everything else unchanged', () => {
  assert.equal(businessFacingName('GLP-1 (RT) – Agonista Triple 12mg'), 'Retatrutide 12mg');
  assert.equal(businessFacingName('GLP-1 10mg'), 'Retatrutide 10mg');
  assert.equal(businessFacingName('BPC-157 10mg'), 'BPC-157 10mg');
  assert.equal(businessFacingName('Tirzepatide 10mg'), 'Tirzepatide 10mg');
});

test('a business sign-in code goes out in the business language; anyone else keeps the page language', async () => {
  const db = rows => ({ from(table) { let filter; return { select() { return this; }, eq(key, value) { filter = filter || [key, value]; return this; }, async maybeSingle() { return { data: (rows[table] || []).find(row => row[filter[0]] === filter[1]) || null }; } }; } });
  const admin = db({ business_accounts: [{ id: 'co', email: 'owner@example.com', preferred_language: 'es' }], business_members: [{ business_id: 'co', email: 'buyer@example.com', active: true }] });
  assert.equal(await businessLanguageFor(admin, 'Owner@Example.com'), 'es');
  assert.equal(await businessLanguageFor(admin, 'buyer@example.com'), 'es');
  assert.equal(await businessLanguageFor(admin, 'stranger@example.com'), null);
  assert.equal(await businessLanguageFor({ from() { throw new Error('down'); } }, 'owner@example.com'), null);
  // The code sits centred in its own table cell, which Outlook keeps.
  assert.match(buildSignInCodeEmail('41016416', 'en').html, /<td align="center"[^>]*>41016416<\/td>/);
});

test('the welcome email introduces Korinne with her photo inside the email and her WhatsApp', () => {
  const letter = buildBusinessAccountEmail({ legal_name: 'Lab SA', email: 'b@example.com', discount_pct: 20, preferred_language: 'en' }, 'https://example.com');
  assert.match(letter.html, /Meet Korinne Dankers, your account manager/);
  assert.match(letter.html, /src="cid:business-agent@peptidescostarica"/);
  assert.match(letter.html, /api\.whatsapp\.com\/send\?phone=50672004080/);
  assert.match(letter.text, /\+506 7200 4080/);
  assert.deepEqual(businessEmailAttachments(letter.html).map(file => file.cid), ['peptides-costa-rica-logo@order-email', 'business-agent@peptidescostarica']);
  // A quote email does not show her, so it does not carry her photo.
  const quote = buildBusinessQuoteRequestEmail({ legal_name: 'Lab SA' }, { id: 'q', items: [] });
  assert.equal(businessEmailAttachments(quote.html).length, 1);
});
