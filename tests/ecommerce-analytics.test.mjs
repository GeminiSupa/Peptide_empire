import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsItem, ecommerceData, orderEcommerceSnapshot, receiptEvent, receiptEvents } from '../src/lib/ecommerceAnalytics.mjs';
import { pushReceiptOnce, pushEvent, whatsappLocation } from '../src/lib/dataLayer.mjs';
import { sanitizeAdAttribution, captureAdClick, readAdClick, CLICK_TTL } from '../src/lib/adClickAttribution.mjs';
import { createAnalyticsReceiptToken, verifyAnalyticsReceiptToken } from '../src/lib/analyticsReceiptToken.js';
const item = { product: 'GLP-1 20mg', category: 'Metabolic & GLP-1', priceUsd: '$134.86', qty: 5 };
const storage = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key,value) => data.set(key,value) }; };
test('item identity is stable without translated marketing labels and includes strength', () => {
  assert.deepEqual(analyticsItem(item), { item_id:'glp-1-20mg',item_name:'GLP-1',item_variant:'20 mg',item_category:'Metabolic & GLP-1',price:134.86,quantity:5,discount:0 });
  assert.equal(analyticsItem({...item,product:'GLP-1 10mg'}).item_id,'glp-1-10mg');
});
test('all money is numeric USD, including CRC-only item rows', () => {
  const data = ecommerceData([{product:'BPC-157 10mg',price:'₡25,100',qty:2}],{rate:502,currency:'CRC'});
  assert.equal(data.currency,'USD'); assert.equal(data.value,100); assert.equal(data.items[0].price,50);
  assert.equal(ecommerceData([item],{discountPct:15}).value,573.16);
});
test('canonical order values exclude shipping and preserve list price and per-unit discount', () => {
  const order={order_number:'WPCR-TEST01',total_usd:578.14,shipping_cost_usd:5,currency:'USD'};
  const snapshot=orderEcommerceSnapshot(order,{products:[item],items:[{product:item.product,qty:5,price:134.86}],promoApplied:true,volumeDiscountPct:15},502);
  assert.equal(snapshot.value,573.14); assert.equal(snapshot.shipping,5); assert.equal(snapshot.transaction_id,'WPCR-TEST01'); assert.equal(snapshot.items[0].price,134.86); assert.equal(snapshot.items[0].discount,20.23);
});
test('clears ecommerce before every ecommerce event and deduplicates only receipt conversions', () => {
  const browser={dataLayer:[]},saved=storage();const event={event:'whatsapp_order',ecommerce:{transaction_id:'WPCR-TEST02',currency:'USD',value:100,items:[]}};
  assert.equal(pushReceiptOnce(event,saved,browser),true); assert.equal(pushReceiptOnce(event,saved,browser),false); assert.deepEqual(browser.dataLayer[0],{ecommerce:null});assert.equal(browser.dataLayer[1].event,'whatsapp_order');
  pushEvent({event:'add_to_cart',ecommerce:{items:[]}},browser);pushEvent({event:'add_to_cart',ecommerce:{items:[]}},browser);assert.equal(browser.dataLayer.filter(row=>row.event==='add_to_cart').length,2);
});
test('receipt cannot call a pending card order a purchase; the WhatsApp receipt event stays whatsapp_order', () => {
  const order={order_number:'WPCR-TEST03',items:[{product:'BPC-157 10mg',qty:1,price:50}],total_usd:50,currency:'USD',status:'Pending',payment_method:'card',customer_email:' Buyer@Example.com ',customer_phone:'88888888'};
  assert.equal(receiptEvent(order),null);const paid=receiptEvent({...order,status:'Paid'});assert.equal(paid.event,'purchase');assert.equal(paid.payment_type,'card');assert.equal(paid.user_data.email,'buyer@example.com');assert.equal(paid.user_data.phone,'+50688888888');
  assert.equal(receiptEvent({...order,payment_method:'whatsapp'}).event,'whatsapp_order');assert.equal(receiptEvent({...order,status:'Unpaid'}),null);
});
test('Google click IDs survive navigation and expire 90 days from the click, without PII', () => {
  const now=Date.now(),document={cookie:''};captureAdClick({search:'?gbraid=braid-1',hostname:'catalog.peptidescostarica.net',protocol:'https:'},document,now);
  assert.match(document.cookie,/Max-Age=7776000/); assert.equal(readAdClick(document,now).gbraid,'braid-1');
  captureAdClick({search:'',hostname:'catalog.peptidescostarica.net'},document,now+1000);assert.equal(readAdClick(document,now+1000).clicked_at,now);
  assert.equal(readAdClick(document,now+CLICK_TTL+1),null);assert.equal(sanitizeAdAttribution({gclid:'bad<script>',clicked_at:now}),null);
});
test('thank-you receipt signatures bind the real order and expire', () => {
  process.env.ANALYTICS_RECEIPT_SECRET='isolated-unit-test-secret';const now=Date.now();const token=createAnalyticsReceiptToken('WPCR-TEST04','order-id',now);
  assert.equal(verifyAnalyticsReceiptToken(token,now).orderNumber,'WPCR-TEST04');assert.equal(verifyAnalyticsReceiptToken(token+'x',now),null);assert.equal(verifyAnalyticsReceiptToken(token,now+8*86400000),null);delete process.env.ANALYTICS_RECEIPT_SECRET;
});
test('WhatsApp button contexts map to the agreed click_location names',()=>{
  assert.equal(whatsappLocation({path:'/catalog',text:'Notify me when back in stock'}),'back_in_stock');assert.equal(whatsappLocation({path:'/coa-database',text:'Request COA'}),'coa_request');assert.equal(whatsappLocation({path:'/thank-you',text:'Forgot something? Add'}),'thank_you_add_item');assert.equal(whatsappLocation({path:'/faq'}),'faq');
});

import { readFileSync } from 'node:fs';
function receiptRoute(dependencies) {
  const source=readFileSync(new URL('../src/app/api/analytics/order-receipt/route.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function POST','async function POST');
  return new Function(...Object.keys(dependencies), source+'; return POST;')(...Object.values(dependencies));
}
test('receipt endpoint never reads customer/order data for an unsigned URL or forged token',async()=>{
  const POST=receiptRoute({verifyAnalyticsReceiptToken:()=>null,getSupabaseAdmin:()=>{throw Error('Must not read');},receiptEvent,receiptEvents});
  assert.equal((await POST(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({token:'forged',order:'WPCR-TEST'})}))).status,403);
});
test('receipt endpoint binds both signed identity fields and waits for card settlement',async()=>{
  const filters=[];const q={select(){return this;},eq(key,value){filters.push([key,value]);return this;},async maybeSingle(){return {data:{order_number:'WPCR-TEST06',items:[{product:'BPC-157 10mg',price:50,qty:1}],currency:'USD',total_usd:50,payment_method:'card',status:'Pending'}};}};
  const POST=receiptRoute({verifyAnalyticsReceiptToken:()=>({orderId:'id1',orderNumber:'WPCR-TEST06'}),getSupabaseAdmin:()=>({from:()=>q}),receiptEvent,receiptEvents});
  const result=await (await POST(new Request('https://test.invalid',{method:'POST',body:'{"token":"signed"}'}))).json();
  assert.equal(result.event,null);assert.equal(result.pending,true);assert.deepEqual(filters,[['id','id1'],['order_number','WPCR-TEST06']]);
});

test('confirmed payment time survives fulfillment but never overrides cancellation or unpaid status',()=>{
  const base={order_number:'WPCR-TEST07',items:[{product:'BPC-157 10mg',price:50,qty:1}],currency:'USD',total_usd:50,payment_method:'card',ads_paid_at:new Date().toISOString()};
  assert.equal(receiptEvent({...base,status:'Processing'}).event,'purchase');assert.equal(receiptEvent({...base,status:'Pending'}),null);assert.equal(receiptEvent({...base,status:'Refunded'}),null);
});

test('bulk discount excludes BAC water and contract unit reductions stay visible',()=>{
  const snapshot=orderEcommerceSnapshot({currency:'USD',total_usd:50,shipping_cost_usd:0},{volumeDiscountPct:15,products:[{product:'BPC-157 10mg',priceUsd:50},{product:'BAC Water 10ml',priceUsd:10}],items:[{product:'BPC-157 10mg',qty:1,price:40},{product:'BAC Water 10ml',qty:1,price:10}]},502);
  assert.equal(snapshot.items[0].price,50);assert.equal(snapshot.items[0].discount,16);assert.equal(snapshot.items[1].discount,0);assert.equal(snapshot.value,50);
});

test('BAC fallback prices match the storefront without assigning a price to free gifts',()=>{
  assert.equal(analyticsItem({product:'BAC Water 10ml',priceUsd:0}).price,20);
  const snapshot=orderEcommerceSnapshot({currency:'USD',total_usd:0,shipping_cost_usd:0},{items:[{product:'BAC Water 10ml',price:0,qty:1}]},502);assert.equal(snapshot.items[0].price,0);
});

test('Spanish and English free-water labels resolve to the same item identity',()=>{
  const en=analyticsItem({product:'Bacteriostatic Water 3ml (Free Gift)',priceUsd:0,analytics_gift:true});const es=analyticsItem({product:'Agua Bacteriostática 3ml (Regalo)',priceUsd:0,analytics_gift:true});assert.equal(en.item_id,es.item_id);assert.equal(en.item_name,es.item_name);assert.equal(es.item_variant,'3 ml');assert.equal(es.price,0);
});

test('a WhatsApp order is only whatsapp_order until paid, but a $0 one is also a purchase; card stays one purchase after payment',()=>{
  const order={order_number:'WPCR-TEST08',items:[{product:'BPC-157 10mg',qty:1,price:50}],total_usd:50,currency:'USD',status:'Pending',payment_method:'whatsapp'};
  const events=receiptEvents(order);assert.deepEqual(events.map(row=>row.event),['whatsapp_order']);assert.equal(events[0].payment_type,'whatsapp');assert.equal(events[0].ecommerce.value,50);
  assert.deepEqual(receiptEvents({...order,total_usd:0.4,total_crc:200}).map(row=>row.event),['whatsapp_order']);
  const free=receiptEvents({...order,order_number:'WPCR-TEST09',total_usd:0,total_crc:0,items:[{product:'Agua Bacteriostática 3ml (Regalo)',qty:1,price:0}]});
  assert.deepEqual(free.map(row=>row.event),['whatsapp_order','purchase']);assert.ok(free.every(row=>row.payment_type==='whatsapp'&&row.ecommerce.value===0&&row.ecommerce.transaction_id==='WPCR-TEST09'));
  const browser={dataLayer:[]},saved=storage();for(const row of free)assert.equal(pushReceiptOnce(row,saved,browser),true);for(const row of free)assert.equal(pushReceiptOnce(row,saved,browser),false);
  assert.deepEqual(browser.dataLayer.filter(row=>row.event).map(row=>row.event),['whatsapp_order','purchase']);
  assert.deepEqual(receiptEvents({...order,payment_method:'card'}),[]);assert.deepEqual(receiptEvents({...order,payment_method:'card',status:'Paid'}).map(row=>row.event),['purchase']);
});
test('receipt endpoint returns purchase only for a $0 WhatsApp order and the thank-you page pushes every event',async()=>{
  for(const total of [50,0]){
    const q={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{order_number:'WPCR-TEST10',items:[{product:'BPC-157 10mg',price:50,qty:1}],currency:'USD',total_usd:total,total_crc:total*500,payment_method:'whatsapp',status:'Pending'}};}};
    const POST=receiptRoute({verifyAnalyticsReceiptToken:()=>({orderId:'id1',orderNumber:'WPCR-TEST10'}),getSupabaseAdmin:()=>({from:()=>q}),receiptEvent,receiptEvents});
    const result=await (await POST(new Request('https://test.invalid',{method:'POST',body:'{"token":"signed"}'}))).json();
    assert.equal(result.event.event,'whatsapp_order');assert.deepEqual(result.events.map(row=>row.event),total?['whatsapp_order']:['whatsapp_order','purchase']);assert.equal(result.pending,false);
  }
  assert.match(readFileSync(new URL('../src/app/thank-you/page.js',import.meta.url),'utf8'),/for \(const event of result\.events\?\.length \? result\.events : \[result\.event\]\) pushReceiptOnce\(event, sessionStorage\)/);
});
