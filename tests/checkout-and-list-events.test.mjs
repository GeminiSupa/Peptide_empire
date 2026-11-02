import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCheckoutEventGate, CHECKOUT_FUNNEL_EVENTS, pushEvent } from '../src/lib/dataLayer.mjs';
import { catalogListName, listViewData, MAX_LIST_ITEMS, HOME_BEST_SELLERS_LIST } from '../src/lib/ecommerceAnalytics.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const catalog = read('src/app/catalog/page.js');
const home = read('src/app/page.js');

test('each checkout funnel event can be claimed once until the checkout ends', () => {
  assert.deepEqual([...CHECKOUT_FUNNEL_EVENTS].sort(), ['add_payment_info', 'add_shipping_info', 'begin_checkout']);
  const gate = createCheckoutEventGate();
  for (const name of CHECKOUT_FUNNEL_EVENTS) {
    assert.equal(gate.claim(name), true, `${name} first claim`);
    assert.equal(gate.claim(name), false, `${name} form refresh`);
    assert.equal(gate.claim(name), false, `${name} second refresh`);
  }
  gate.reset();
  for (const name of CHECKOUT_FUNNEL_EVENTS) assert.equal(gate.claim(name), true, `${name} next checkout`);
});

test('claiming one funnel event does not use up another', () => {
  const gate = createCheckoutEventGate();
  assert.equal(gate.claim('begin_checkout'), true);
  assert.equal(gate.claim('add_shipping_info'), true);
  assert.equal(gate.claim('add_payment_info'), true);
});

test('a re-rendering checkout form pushes each funnel event to the data layer once', () => {
  const browser = { dataLayer: [] }, gate = createCheckoutEventGate();
  const track = name => { if (CHECKOUT_FUNNEL_EVENTS.has(name) && !gate.claim(name)) return; pushEvent({ event: name, ecommerce: { items: [] } }, browser); };
  for (let render = 0; render < 3; render += 1) { track('begin_checkout'); track('add_shipping_info'); track('add_payment_info'); track('add_payment_info'); }
  for (const name of CHECKOUT_FUNNEL_EVENTS) assert.equal(browser.dataLayer.filter(row => row.event === name).length, 1, name);
});

test('list names: home best sellers, shop, category, deal', () => {
  assert.equal(HOME_BEST_SELLERS_LIST, 'Home - Best sellers');
  assert.equal(catalogListName({ category: 'all' }), 'Shop');
  assert.equal(catalogListName(), 'Shop');
  assert.equal(catalogListName({ category: 'Metabolic & GLP-1' }), 'Metabolic & GLP-1');
  assert.equal(catalogListName({ category: 'Metabolic & GLP-1', dealOnly: true }), 'Deal of the Week');
  assert.equal(catalogListName({ category: '  ' }), 'Shop');
});

test('one view_item_list payload carries every product, the real list name and positions', () => {
  const products = [
    { product: 'BPC-157 10mg', category: 'Recovery', priceUsd: '$50.00' },
    { product: 'GLP-1 20mg', category: 'Metabolic & GLP-1', priceUsd: '$134.86' },
  ];
  const data = listViewData(products, 'Shop');
  assert.equal(data.item_list_name, 'Shop');
  assert.equal(data.item_list_id, 'shop');
  assert.equal(data.items.length, 2);
  assert.deepEqual(data.items.map(item => item.index), [1, 2]);
  assert.ok(data.items.every(item => item.item_list_name === 'Shop' && item.item_list_id === 'shop'));
  assert.deepEqual(data.items.map(item => item.item_id), ['bpc-157-10mg', 'glp-1-20mg']);
  assert.ok(data.items.every(item => !('quantity' in item) && !('discount' in item)));
  assert.equal(listViewData(products, 'Home - Best sellers').item_list_id, 'home-best-sellers');
  assert.notEqual(JSON.stringify(data).includes('General Product List'), true);
});

test('a long list stays inside GA4’s 200 items per event', () => {
  const many = Array.from({ length: 260 }, (_, index) => ({ product: `Peptide ${index} 5mg`, priceUsd: 10 }));
  const data = listViewData(many, 'Shop');
  assert.equal(data.items.length, MAX_LIST_ITEMS);
  assert.equal(data.items.at(-1).index, MAX_LIST_ITEMS);
});

test('catalog sends the funnel through the gate and add_shipping_info from both submit paths', () => {
  assert.match(catalog, /CHECKOUT_FUNNEL_EVENTS\.has\(event\) && !checkoutEventGate\.claim\(event\)\) return;/);
  assert.match(catalog, /checkoutEventGate\.reset\(\)/);
  assert.equal(catalog.split("trackCartEvent('add_shipping_info')").length - 1, 2);
  // Every funnel event goes through trackCartEvent; nothing pushes them around the gate.
  assert.equal(/pushEvent\(\{\s*event:\s*['"](?:begin_checkout|add_shipping_info|add_payment_info)/.test(catalog), false);
});

test('view_item_list is sent once per list from the catalog and the home page, never batched or generically named', () => {
  assert.equal(catalog.split("event: 'view_item_list'").length - 1, 1);
  assert.equal(home.split("event: 'view_item_list'").length - 1, 1);
  assert.match(catalog, /analyticsListedName\.current === analyticsListName\) return;/);
  assert.match(home, /homeListSent\.current/);
  assert.match(home, /listViewData\(nextProducts\.slice\(0, 4\), HOME_BEST_SELLERS_LIST\)/);
  assert.equal(/General Product List/.test(catalog + home), false);
});
