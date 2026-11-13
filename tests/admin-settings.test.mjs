import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bannersFrom, contactFrom, contactReplacements, reviewLinksFrom, ribbonFor, socialLinksFrom } from '../lib/site/admin-settings.mjs';
import { salePrice } from '../lib/storefront/sale-price.mjs';
import { CONTACT } from '../lib/site/contact.mjs';

test('the admin\'s Business info replaces the design\'s contact details', () => {
  const contact = contactFrom({ whatsappNumber: '50611112222', whatsappDisplay: '+506 1111-2222', supportEmail: 'hola@x.cr', apiWhatsAppNumber: '', apiWhatsAppDisplay: '' });
  assert.equal(contact.whatsapp, '50611112222');
  assert.equal(contact.phoneCrHref, 'tel:+50611112222');
  assert.equal(contact.email, 'hola@x.cr');
  assert.equal(contact.phoneUs, CONTACT.phoneUs, 'a field left empty in the admin keeps the design\'s');
  assert.deepEqual(contactFrom({}), CONTACT);
});

test('a retired number saved in the admin never reaches the page', () => {
  const contact = contactFrom({ whatsappNumber: '50684046973', whatsappDisplay: '+506 8404-6973' });
  assert.equal(contact.whatsapp, '50660604775');
  assert.equal(contact.phoneCr, '+506 6060-4775');
  assert.equal(contact.phoneCrHref, 'tel:+50660604775');
  assert.deepEqual(contactReplacements(contact), []);
});

test('page text and links follow the admin\'s contact details only when they differ', () => {
  assert.deepEqual(contactReplacements(CONTACT), []);
  const pairs = contactReplacements(contactFrom({ whatsappNumber: '50611112222', whatsappDisplay: '+506 1111-2222' }));
  assert.ok(pairs.some(([from, to]) => from === '+506 6060-4775' && to === '+506 1111-2222'));
  assert.ok(pairs.some(([from, to]) => from === 'wa.me/50660604775' && to === 'wa.me/50611112222'));
});

test('review links come from the admin, per language', () => {
  const links = { trustpilotUrlEn: 'https://en.tp', trustpilotUrlEs: 'https://es.tp', googleReviewUrl: '' };
  assert.deepEqual(reviewLinksFrom(links, 'es'), { trustpilot: 'https://es.tp' });
  assert.deepEqual(reviewLinksFrom(links, 'en'), { trustpilot: 'https://en.tp' });
});

test('blank CMS social fields remove Facebook and Instagram from the main website', () => {
  const hidden = socialLinksFrom({ facebookUrl: '', instagramUrl: '' });
  assert.equal(hidden.some(([name]) => name === 'Facebook' || name === 'Instagram'), false);
  const visible = socialLinksFrom({ facebookUrl: 'https://facebook.example/page', instagramUrl: 'https://instagram.example/page' });
  assert.deepEqual(visible.filter(([name]) => name === 'Facebook' || name === 'Instagram'), [
    ['Facebook', 'https://facebook.example/page'],
    ['Instagram', 'https://instagram.example/page'],
  ]);
});

test('only active banners show, written as the catalog writes them', () => {
  const banners = bannersFrom([
    { id: 'a', isActive: true, textEn: 'FREE SHIPPING OVER {{usd_200}}!', textEs: 'ENVÍO GRATIS SOBRE {{usd_200}}' },
    { id: 'b', isActive: false, textEn: 'old sale' },
    { id: 'c', isActive: true, textEn: '[**Shop the sale**](/catalog?deal=1)' },
    { id: 'd', isActive: true, textEn: 'Bad link', href: 'javascript:alert(1)' },
  ], 'en');
  assert.deepEqual(banners, [
    { id: 'a', text: 'FREE SHIPPING OVER $200!', href: '' },
    { id: 'c', text: 'Shop the sale', href: '/catalog?deal=1' },
    { id: 'd', text: 'Bad link', href: '' },
  ]);
  assert.equal(bannersFrom([{ id: 'a', isActive: true, textEn: 'x', textEs: 'y' }], 'es')[0].text, 'y');
});

test('a sale price shows only inside its window, and only above today\'s price', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const row = { discount: 'Sale', price_usd: '90', original_price_usd: '$120' };
  assert.equal(salePrice(row, now), 120);
  assert.equal(salePrice({ ...row, sale_start_time: '2026-11-09T00:00:00Z' }, now), null);
  assert.equal(salePrice({ ...row, sale_end_time: '2026-11-07T00:00:00Z' }, now), null);
  assert.equal(salePrice({ ...row, original_price_usd: '80' }, now), null);
  assert.equal(salePrice({ ...row, discount: '' }, now), null);
});

test('a ribbon shows for the products a badge code covers, never for hidden or expired codes', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const promos = [
    { code: 'GHK15', discount_pct: 0.15, is_active: true, hidden: false, show_sale_badge: true, target_product: 'GHK-CU 50mg', badge_style: 'code' },
    { code: 'OLD', discount_pct: 0.5, is_active: true, hidden: false, show_sale_badge: true, target_product: 'BPC-157 10mg', valid_until: '2026-01-01T00:00:00Z' },
  ];
  assert.ok(ribbonFor(promos, 'GHK-CU 50mg', 'en', now));
  assert.equal(ribbonFor(promos, 'BPC-157 10mg', 'en', now), null);
  assert.equal(ribbonFor(promos, 'TB-500 5mg', 'en', now), null);
});
