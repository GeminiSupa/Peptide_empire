import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsItem, ecommerceData, pushEvent, whatsappLocation, whatsappOrderEvent } from '../lib/site/analytics.mjs';

test('items match the catalog: id from name and size, dollar price, discount', () => {
  assert.deepEqual(analyticsItem({ name: 'BPC-157', size: '10 mg', priceUsd: 90, qty: 5, category: 'Tissue Repair Compounds' }, 0.15), {
    item_id: 'bpc-157-10mg',
    item_name: 'BPC-157',
    item_variant: '10 mg',
    item_category: 'Tissue Repair Compounds',
    price: 90,
    quantity: 5,
    discount: 13.5,
  });
  // BAC water is never discounted, as in the catalog.
  assert.equal(analyticsItem({ name: 'BAC Water', size: '10 ml', priceUsd: 20, qty: 1 }, 0.15).discount, 0);
});

test('ecommerce is in dollars, net of the discount', () => {
  const data = ecommerceData([{ name: 'BPC-157', size: '10 mg', priceUsd: 90, qty: 5 }], { discountPct: 0.15, extras: { payment_type: 'card' } });
  assert.equal(data.currency, 'USD');
  assert.equal(data.value, 382.5);
  assert.equal(data.payment_type, 'card');
});

test('pushEvent clears the previous ecommerce object first', () => {
  const browser = {};
  pushEvent({ event: 'view_item', ecommerce: { items: [] } }, browser);
  assert.deepEqual(browser.dataLayer[0], { ecommerce: null });
  assert.equal(browser.dataLayer[1].event, 'view_item');
});

test('a WhatsApp order reports its dollar value, shipping and order number', () => {
  const event = whatsappOrderEvent({
    orderNumber: 'W-1',
    currency: 'CRC',
    exchangeRate: 500,
    total: 192500, // ₡190,000 of vials after 15% + ₡2,500 delivery
    shipping: 2500,
    lines: [{ name: 'BPC-157', size: '10 mg', priceUsd: 89.4117647, qty: 5 }],
  });
  assert.equal(event.event, 'whatsapp_order');
  assert.equal(event.ecommerce.transaction_id, 'W-1');
  assert.equal(event.ecommerce.value, 380);
  assert.equal(event.ecommerce.shipping, 5);
  assert.equal(whatsappOrderEvent(null), null);
});

test('WhatsApp click locations use the catalog names', () => {
  assert.equal(whatsappLocation({ text: 'Notify me' }), 'back_in_stock');
  assert.equal(whatsappLocation({ path: '/contact-costa-rica/', text: 'Chat on WhatsApp' }), 'contact_page');
  assert.equal(whatsappLocation({ path: '/thank-you/', text: 'Add' }), 'thank_you_add_item');
  assert.equal(whatsappLocation({ path: '/', text: 'WhatsApp' }), 'floating_button');
});
