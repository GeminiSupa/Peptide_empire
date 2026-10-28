import test from 'node:test';
import assert from 'node:assert/strict';
import {planAdditionalCommission,additionalCommissionOrders,mergeAdditionalCommissionOrders,additionalCommissionSnapshotMatches,additionalCommissionClawbacks,ADDITIONAL_COMMISSION_FIELDS} from '../src/lib/additionalCommission.mjs';
import {buildPaidOrderIndex,hasBeenPaid,priceStampedOverrideOrders,stampOverrideOrder,reattachOverrideStamps} from '../src/lib/subUserCommission.mjs';
import {computeOrderCommissionAmounts} from '../src/lib/orderCommission.mjs';
import {getOrderSalesAmounts} from '../src/lib/commissionSalesAmounts.mjs';
import {stashReorder,takeReorder} from '../src/lib/reorderHandoff.js';
import {readFileSync} from 'node:fs';

const korinne={user_id:'korinne',name:'Korinne',email:'korinne@example.invalid',status:'active',tier:'staff',commission_rate:10};
const melissa={user_id:'melissa',name:'Melissa',email:'melissa@example.invalid',status:'active',tier:'staff'};
const profiles=[korinne,melissa];
const date='2026-10-28T07:00:00Z';
const order={id:'sale',order_number:'TEST-ONCE',sales_agent:'Korinne',status:'Paid',total_usd:100,total_crc:50000,created_at:'2026-10-27T00:00:00Z',items:[{product:'BPC-157',qty:1,price:100}]};
const request={additional_commission_user_id:'melissa',additional_commission_pct:10,additional_commission_reason:'One-time extra for Melissa on this sale only'};
const configured={...order,...planAdditionalCommission(order,request,profiles,date).patch};

test('Melissa gets an additional ten percent while Korinne ownership and commission stay unchanged',()=>{
  const plan=planAdditionalCommission(order,request,profiles,date);
  assert.equal(plan.ok,true);assert.equal(plan.patch.additional_commission_pct,10);
  assert.equal(plan.patch.sales_agent,undefined);assert.equal(plan.patch.agent_commission_rate_override,undefined);assert.equal(plan.patch.affiliate_id,undefined);
  const extra=additionalCommissionOrders([configured],melissa);
  assert.equal(priceStampedOverrideOrders(extra,getOrderSalesAmounts).overrideUsd,10);
  assert.equal(computeOrderCommissionAmounts(configured,korinne.commission_rate,getOrderSalesAmounts).usdCommission,10);
  assert.equal(configured.sales_agent,'Korinne');
});
test('repeat purchases by the same customer do not inherit the one-time commission',()=>{
  const repeat={...order,id:'repeat',created_at:'2026-10-29T00:00:00Z'};
  assert.equal(additionalCommissionOrders([repeat],melissa).length,0);
  assert.equal(additionalCommissionOrders([configured,repeat],melissa).length,1);
});
test('reorder handoff copies products only and leaves the one-time allocation behind',()=>{
  const previousWindow=globalThis.window,previousStorage=globalThis.localStorage;const entries=new Map();
  globalThis.window={};globalThis.localStorage={setItem:(key,value)=>entries.set(key,value),getItem:key=>entries.get(key),removeItem:key=>entries.delete(key)};
  try{assert.equal(stashReorder(configured),true);const pending=takeReorder();assert.equal(pending.additional_commission_user_id,undefined);assert.equal(pending.additional_commission_pct,undefined);assert.equal(pending.items.length,1);}finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;}
});
test('paid-order checks are per recipient: Korinne paid does not suppress Melissa but Melissa paid does',()=>{
  const paid=buildPaidOrderIndex([{agent_email:korinne.email,orders_data:[configured]}]);
  assert.equal(additionalCommissionOrders([configured],melissa,{isPaid:row=>hasBeenPaid(paid,melissa.email,row.id)}).length,1);
  const melissaPaid=buildPaidOrderIndex([{agent_email:melissa.email,override_orders_data:[configured]}]);
  assert.equal(additionalCommissionOrders([configured],melissa,{isPaid:row=>hasBeenPaid(melissaPaid,melissa.email,row.id)}).length,0);
});
test('rescans and duplicate extra rows do not multiply the one-time amount',()=>{
  const extra=additionalCommissionOrders([configured],melissa);
  const merged=mergeAdditionalCommissionOrders([], [...extra,...extra]);
  assert.equal(merged.length,1);assert.equal(priceStampedOverrideOrders(merged,getOrderSalesAmounts).overrideUsd,10);
  assert.equal(priceStampedOverrideOrders(mergeAdditionalCommissionOrders(merged,extra),getOrderSalesAmounts).overrideUsd,10);
});
test('a separate existing team override and one-time cut share one sales base',()=>{
  const base=[stampOverrideOrder(configured,{rate:2,name:'Korinne',kind:'team'})];
  const extra=additionalCommissionOrders([configured],melissa);
  const merged=mergeAdditionalCommissionOrders(base,extra);const amounts=priceStampedOverrideOrders(merged,getOrderSalesAmounts);
  assert.equal(merged.length,1);assert.equal(amounts.salesUsd,100);assert.equal(amounts.overrideUsd,12);
});
test('notes are visible requirements in the allocation rules; bad recipients and percentages are refused',()=>{
  for(const pct of [0,-1,101,Infinity,'bad'])assert.equal(planAdditionalCommission(order,{...request,additional_commission_pct:pct},profiles).ok,false);
  assert.equal(planAdditionalCommission(order,{...request,additional_commission_reason:''},profiles).ok,false);
  assert.equal(planAdditionalCommission(order,{...request,additional_commission_reason:'a'.repeat(501)},profiles).ok,false);
  assert.equal(planAdditionalCommission(order,{...request,additional_commission_user_id:'korinne'},profiles).ok,false);
  assert.equal(planAdditionalCommission(order,request,[korinne,{...melissa,status:'suspended'}]).ok,false);
  assert.equal(planAdditionalCommission(order,request,[korinne,{...melissa,tier:'affiliate'}]).ok,false);
});
test('removing an unpaid one-time allocation clears all four fields without changing ownership',()=>{
  const removed=planAdditionalCommission(configured,{additional_commission_user_id:null,additional_commission_pct:null,additional_commission_reason:'Remove this allocation before payment'},profiles);
  assert.equal(removed.ok,true);assert.equal(removed.patch.additional_commission_user_id,null);assert.equal(removed.patch.additional_commission_pct,null);assert.equal(removed.patch.additional_commission_assigned_at,null);assert.equal(removed.patch.additional_commission_reason,null);assert.equal(removed.patch.sales_agent,undefined);
});
test('editing only the allocation note does not move the commission into another pay period',()=>{
  const plan=planAdditionalCommission(configured,{additional_commission_reason:'Clarified one-time sale note'},profiles,'2026-11-05T00:00:00Z');
  assert.equal(plan.rateChanged,false);assert.equal(plan.patch.additional_commission_assigned_at,date);
});
test('an old paid sale assigned today belongs to the assignment week once',()=>{
  const old={...configured,created_at:'2026-09-01T00:00:00Z'};
  const options={startMs:Date.parse('2026-10-26T00:00:00Z'),endMs:Date.parse('2026-11-01T23:59:59Z')};
  assert.equal(additionalCommissionOrders([old],melissa,options).length,1);
  assert.equal(additionalCommissionOrders([old],melissa,{startMs:Date.parse('2026-09-01T00:00:00Z'),endMs:Date.parse('2026-09-07T23:59:59Z')}).length,0);
});
test('pending, fully refunded, excluded and inactive recipients earn no extra payout',()=>{
  for(const status of ['Pending','Cancelled','Refunded','Declined'])assert.equal(additionalCommissionOrders([{...configured,status}],melissa).length,0);
  assert.equal(additionalCommissionOrders([{...configured,stats_override:'exclude'}],melissa).length,0);
  assert.equal(additionalCommissionOrders([configured],{...melissa,status:'suspended'}).length,0);
});
test('partial refunds reduce unpaid extra commission using the same net sales calculation',()=>{
  const refunded={...configured,status:'Partly Refunded',refunded_amount_usd:25,refunded_amount_crc:12500};
  const result=priceStampedOverrideOrders(additionalCommissionOrders([refunded],melissa),getOrderSalesAmounts);
  assert.equal(result.overrideUsd,7.5);assert.equal(result.overrideCrc,3750);
});
test('approval rejects changed recipients/rates and preserves the additional-rate stamp',()=>{
  const saved=additionalCommissionOrders([configured],melissa);
  assert.equal(additionalCommissionSnapshotMatches([configured],saved),true);
  assert.equal(additionalCommissionSnapshotMatches([{...configured,additional_commission_pct:15}],saved),false);
  assert.equal(additionalCommissionSnapshotMatches([{...configured,additional_commission_user_id:null}],saved),false);
  assert.equal(additionalCommissionSnapshotMatches([],saved),true);
  const refreshed=reattachOverrideStamps([configured],saved);assert.equal(refreshed[0].commission_additional_user_id,'melissa');assert.equal(refreshed[0].commission_additional_rate,10);
});
test('later refunds claw back one-time money from the paid recipient once per event',()=>{
  const payout={agent_email:melissa.email,agent_name:'Melissa',override_orders_data:additionalCommissionOrders([configured],melissa)};
  const cuts=additionalCommissionClawbacks([payout,payout],configured,{ok:true,refundUsd:20,refundCrc:10000});
  assert.equal(cuts.length,1);assert.equal(cuts[0].owedUsd,2);assert.equal(cuts[0].owedCrc,1000);
  assert.equal(additionalCommissionClawbacks([],configured,{ok:true,refundUsd:20}).length,0);
});

function updateRoute({superadmin=false,recipient=melissa,payouts=[]}={}){
  const query=table=>({select(){return this;},eq(){return this;},in(){return this;},range(){return Promise.resolve({data:payouts});},single(){return Promise.resolve({data:order});},then(resolve){return Promise.resolve({data:table==='admin_profiles'?[korinne,recipient]:[]}).then(resolve);}});
  const dependencies={NextResponse:{json:(value,options)=>Response.json(value,options)},isFirstPaidTransition:()=>false,verifyAdminSession:async()=>({user:{email:'owner@test'},profile:{is_superadmin:superadmin}}),getSupabaseAdmin:()=>({from:query}),orderVisibleToAgent:()=>true,ADDITIONAL_COMMISSION_FIELDS,planAdditionalCommission,PAYOUT_RESERVED_STATUSES:['Approved'],buildPaidOrderIndex,hasBeenPaid};
  const source=readFileSync(new URL('../src/app/api/admin/orders/update/route.js',import.meta.url),'utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm,'').replace(/export /g,'');
  return new Function(...Object.keys(dependencies),`${source}; return PATCH;`)(...Object.values(dependencies));
}
test('the real update endpoint refuses staff allocation edits and previously approved extra payouts',async()=>{
  const requestFor=()=>new Request('https://example.invalid/api/admin/orders/update',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.id,updates:request})});
  const regular=await updateRoute()(requestFor());assert.equal(regular.status,403);
  const paid=await updateRoute({superadmin:true,payouts:[{agent_email:melissa.email,override_orders_data:[order]}]})(requestFor());assert.equal(paid.status,409);
});
