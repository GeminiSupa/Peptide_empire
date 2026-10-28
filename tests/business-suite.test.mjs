import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBusinessItems,validateBusinessTerms,businessMinimumError,validatedQuotePrices,canManageBusiness,businessSalesReport} from '../src/lib/businessSuite.mjs';
import {authoritativeCheckout} from '../src/lib/authoritativeCheckout.mjs';
import {businessInvoiceHtml} from '../src/lib/businessInvoice.mjs';
import {readBusinessQuote} from '../src/lib/businessHandoff.mjs';
import {orderCommissionRate} from '../src/lib/orderCommission.mjs';
import {findBusinessAccount} from '../src/lib/businessAccounts.mjs';

const product={product:'BPC-157 10mg',price_usd:'$100',status:'In Stock',inventory_count:100};
const cart=[{product:product.product,qty:2}];
const quote=(extra={})=>authoritativeCheckout({postedOrder:{currency:'USD',items:cart},products:[product],exchangeRate:500,...extra});

test('saved lists and quotes enforce storefront quantity limits and reject duplicate/free-gift lines',()=>{
  assert.deepEqual(normalizeBusinessItems([{product:' BPC ',qty:'3',price:1,status:'approved'}]),[{product:'BPC',qty:3}]);
  for(const items of [[],[{product:'A',qty:101}],[{product:'A',qty:0}],[{product:'A',qty:1.1}],[{product:'A',qty:1},{product:'a',qty:1}],[{product:'A (Free Gift)',qty:1}],Array.from({length:51},(_,i)=>({product:`P${i}`,qty:1}))])assert.throws(()=>normalizeBusinessItems(items));
});
test('quote approvals require valid non-BAC prices and preserve zero-dollar merchandise',()=>{
  assert.equal(normalizeBusinessItems([{product:'A',qty:1,unit_price_usd:0}],{prices:true})[0].unit_price_usd,0);
  for(const price of [null,'',-1,Infinity,'bad'])assert.throws(()=>normalizeBusinessItems([{product:'A',qty:1,unit_price_usd:price}],{prices:true}));
  assert.throws(()=>normalizeBusinessItems([{product:'Bacteriostatic Water 3ml',qty:1,unit_price_usd:2}],{prices:true}));
});
test('minimum order settings and commission terms cannot be invalid or unassigned',()=>{
  assert.equal(validateBusinessTerms({minimum_units:'10',minimum_order_usd:'200'}).minimum_units,10);
  assert.throws(()=>validateBusinessTerms({minimum_units:1.5}));
  assert.throws(()=>validateBusinessTerms({minimum_order_usd:-1}));
  assert.throws(()=>validateBusinessTerms({rep_commission_pct:20}));
  assert.equal(validateBusinessTerms({rep_user_id:'rep',rep_commission_pct:15}).rep_commission_pct,15);
});
test('buyer permissions distinguish company owners, managers and buyers',()=>{
  assert.equal(canManageBusiness({email:'owner@test',member_role:'buyer'},'owner@test'),true);
  assert.equal(canManageBusiness({email:'owner@test',member_role:'manager'},'buyer@test'),true);
  assert.equal(canManageBusiness({email:'owner@test',member_role:'buyer'},'buyer@test'),false);
});
test('minimum spend excludes shipping and merchandise quantities exclude BAC and gifts',()=>{
  const business={status:'approved',minimum_units:3,minimum_order_usd:100};
  assert.match(businessMinimumError(business,{total:200,shipping:5,currency:'USD'},[...cart,{product:'Bacteriostatic Water 3ml',qty:10}],500),/3 merchandise/);
  assert.equal(businessMinimumError({...business,minimum_units:2},{total:52500,shipping:2500,currency:'CRC'},cart,500),null);
  assert.match(businessMinimumError({...business,minimum_units:2},{total:50000,shipping:2500,currency:'CRC'},cart,500),/US\$100/);
  assert.equal(businessMinimumError({...business,status:'suspended'},{},[],500),null);
});
test('contract prices never stack with percentage pricing and flow into canonical order lines',()=>{
  const result=quote({businessDiscountPct:20,businessProductPrices:[{product:product.product,unit_price_usd:60}]});
  assert.equal(result.contractApplied,true);
  assert.equal(result.volumeDiscountPct,0);
  assert.equal(result.items.find(item=>item.product===product.product).price,60);
  assert.equal(result.total,125);
  assert.equal(result.businessSavings,80);
  const percentageWins=quote({businessDiscountPct:50,businessProductPrices:[{product:product.product,unit_price_usd:90}]});
  assert.equal(percentageWins.total,105);
});
test('public promotions can beat contract pricing, and contract shipping uses discounted value',()=>{
  const result=quote({businessProductPrices:[{product:product.product,unit_price_usd:60}],promo:{discount_pct:0.75}});
  assert.equal(result.contractApplied,false);
  assert.equal(result.total,50);
  const crc=quote({businessProductPrices:[{product:product.product,unit_price_usd:60}],postedOrder:{currency:'CRC',items:cart}});
  assert.equal(crc.total,62500);
});
test('forged checkout prices are ignored unless explicitly resolved by the server',()=>{
  const result=quote({postedOrder:{currency:'USD',businessProductPrices:[{product:product.product,unit_price_usd:1}],items:cart}});
  assert.equal(result.total,200);
  assert.equal(result.contractApplied,false);
});
test('quote checkout binds the company, expiry, products and exact quantities',()=>{
  const now=Date.parse('2026-10-28T00:00:00Z');
  const approved={id:'quote',business_id:'company',status:'approved',expires_at:'2026-10-29T00:00:00Z',items:[{...cart[0],unit_price_usd:60}]};
  assert.equal(validatedQuotePrices(approved,'company',cart,now)[0].unit_price_usd,60);
  assert.throws(()=>validatedQuotePrices(approved,'other',cart,now));
  assert.throws(()=>validatedQuotePrices(approved,'company',[{...cart[0],qty:3}],now));
  assert.throws(()=>validatedQuotePrices({...approved,status:'requested'},'company',cart,now));
  assert.throws(()=>validatedQuotePrices({...approved,expires_at:'invalid'},'company',cart,now));
  assert.throws(()=>validatedQuotePrices(approved,'company',cart,now+2*86400000));
  assert.equal(readBusinessQuote(JSON.stringify(approved),'company',now).id,'quote');
  assert.equal(readBusinessQuote(JSON.stringify(approved),'other',now),null);
});
test('business reports count paid net revenue, repeat customers, follow-ups and historical rep rates',()=>{
  const businesses=[{id:'b',legal_name:'Company',status:'approved',rep_user_id:'current-rep'},{id:'c',legal_name:'New company',status:'approved'}];
  const base={business_account_id:'b',status:'Paid',total_usd:100,total_crc:50000,business_snapshot:{rep_user_id:'historical-rep'},agent_commission_source:'business_account',agent_commission_rate_override:10,created_at:'2026-10-01T00:00:00Z'};
  const orders=[base,{...base,status:'Partly Refunded',refunded_amount_usd:25,refunded_amount_crc:12500},{...base,status:'Pending',total_usd:10000}];
  const report=businessSalesReport(businesses,orders,Date.parse('2026-11-10T00:00:00Z'));
  assert.equal(report.totals.revenue_usd,175);
  assert.equal(report.totals.repeat_buyers,1);
  assert.equal(report.businesses.every(row=>row.needs_follow_up),true);
  assert.equal(report.reps[0].rep_user_id,'historical-rep');
  assert.equal(report.reps[0].commission_usd,17.5);
  assert.equal(orderCommissionRate({agent_commission_source:'business_account',agent_commission_rate_override:0},20),0);
  assert.equal(orderCommissionRate({agent_commission_rate_override:0},20),20);
});
test('billing downloads escape company data and use the immutable order snapshot',()=>{
  const html=businessInvoiceHtml({order_number:'TEST-1',currency:'USD',status:'Pending',total_usd:95,shipping_cost_usd:5,items:[{product:'<script>x</script>',qty:1,price:100}],business_snapshot:{legal_name:'Company & Co',corporation_number:'3101999999',billing_address:'Saved address'}});
  assert.match(html,/Company &amp; Co/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Saved address/);assert.match(html,/3101999999/);assert.match(html,/\$95\.00/);assert.match(html,/not an electronic tax invoice/);assert.match(html,/confirm payment/);
});
test('active member lookup is scoped to its linked business and removed buyers get no company access',async()=>{
  const queries=[];
  const admin={from(table){let column,value;return {select(){return this;},eq(key,entry){queries.push([table,key,entry]);column=key;value=entry;return this;},async maybeSingle(){if(table==='business_members')return {data:{business_id:'business',role:'buyer'}};return {data:column==='id'&&value==='business'?{id:'business',email:'owner@test'}:null};}};}};
  const member=await findBusinessAccount(admin,'employee@test');
  assert.equal(member.id,'business');assert.equal(member.member_role,'buyer');
  assert.ok(queries.some(([table,key,value])=>table==='business_members'&&key==='active'&&value===true));
});
