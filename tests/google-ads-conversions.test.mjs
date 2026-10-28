import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { offlineConversionEvent, googleAdsDestination, googleRequestState } from '../src/lib/googleAdsConversions.mjs';
import { googleAdsClient } from '../src/lib/googleAdsClient.js';
import { runGoogleAdsImport } from '../src/lib/googleAdsImport.mjs';
const now=Date.now(), paid=new Date(now-1000).toISOString();
const order={id:'order1',order_number:'WPCR-TEST05',payment_method:'whatsapp',status:'Paid',total_usd:573.14,ad_attribution:{gclid:'test-gclid',clicked_at:now-100000},customer_email:' Test.Name@gmail.com ',customer_phone:'88888888'};
const env={GOOGLE_ADS_CUSTOMER_ID:'123-456-7890',GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID:'12345',GOOGLE_ADS_CLIENT_ID:'unit-client',GOOGLE_ADS_CLIENT_SECRET:'unit-secret',GOOGLE_ADS_REFRESH_TOKEN:'unit-refresh'};
test('paid WhatsApp export has the real order, Costa Rica offset, USD and hashed contacts',()=>{
  const event=offlineConversionEvent(order,paid);assert.equal(event.transactionId,order.order_number);assert.equal(event.currency,'USD');assert.equal(event.conversionValue,573.14);assert.match(event.eventTimestamp,/-06:00$/);assert.equal(event.userData.userIdentifiers[0].emailAddress,createHash('sha256').update('testname@gmail.com').digest('hex'));assert.ok(!JSON.stringify(event).includes('Test.Name'));assert.ok(!JSON.stringify(event).includes('88888888'));
});
test('email-only and phone-only matching work without a click ID',()=>{
  assert.ok(offlineConversionEvent({...order,ad_attribution:null},paid).userData);assert.throws(()=>offlineConversionEvent({...order,ad_attribution:null,customer_email:null,customer_phone:null},paid));
});
test('unpaid, card, canceled and test orders are excluded; refunds reduce pre-upload value',()=>{
  for(const patch of [{status:'Pending'},{status:'Unpaid'},{status:'Canceled'},{payment_method:'card'},{stats_override:'exclude'},{internal_notes:'TEST order'}])assert.throws(()=>offlineConversionEvent({...order,...patch},paid));
  assert.equal(offlineConversionEvent({...order,refunded_amount_usd:100},paid).conversionValue,473.14);
});
test('submission is distinct from final acceptance and duplicate order IDs are safe',()=>{
  assert.equal(googleRequestState({requestStatusPerDestination:[{requestStatus:'PROCESSING'}]}),'submitted');assert.equal(googleRequestState({requestStatusPerDestination:[{requestStatus:'SUCCESS'}]}),'accepted');assert.equal(googleRequestState({requestStatusPerDestination:[{requestStatus:'PARTIAL_SUCCESS',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_INVALID_GCLID'}]}}]}),'failed');assert.equal(googleRequestState({requestStatusPerDestination:[{requestStatus:'FAILED',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_DUPLICATE_TRANSACTION_ID'}]}}]}),'accepted');
});
test('OAuth credentials stay server-side and the current Data Manager payload uses hashes',async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('oauth2')?{access_token:'unit-access'}:{requestId:'unit-request'}};};
  const client=await googleAdsClient(env,fetcher);await client.upload(offlineConversionEvent(order,paid),true);assert.equal(calls[1].url,'https://datamanager.googleapis.com/v1/events:ingest');const body=JSON.parse(calls[1].options.body);assert.equal(body.validateOnly,true);assert.equal(body.encoding,'HEX');assert.equal(body.destinations[0].operatingAccount.accountId,'1234567890');assert.ok(!calls[1].options.body.includes('unit-refresh'));assert.throws(()=>googleAdsDestination({}));
});
function fixture() {
  const queue=[{id:'q1',order_id:'order1',paid_at:paid,status:'leased',attempts:1}], writes=[];
  const admin={async rpc(){return {data:queue.splice(0)};},from(table){let values,filters={};const q={select(){return q;},eq(key,value){filters[key]=value;return q;},order(){return q;},limit(){return Promise.resolve({data:[]});},update(v){values=v;return q;},async maybeSingle(){return {data:order};},then(resolve){writes.push({id:filters.id,...values});return Promise.resolve({error:null}).then(resolve);}};return q;}};
  return {admin,writes};
}
test('worker records submitted, not accepted, after a successful HTTP upload',async()=>{
  const f=fixture();const result=await runGoogleAdsImport(f.admin,{destination:'unit',upload:async()=>({requestId:'request-1'})});assert.equal(result.submitted,1);assert.equal(result.accepted,0);assert.equal(f.writes[0].status,'submitted');assert.equal(f.writes[0].request_id,'request-1');
});
test('worker keeps failures retryable instead of losing a day of paid sales',async()=>{
  const f=fixture();const result=await runGoogleAdsImport(f.admin,{destination:'unit',upload:async()=>{throw Error('Google unavailable');}});assert.equal(result.failed,1);assert.equal(f.writes[0].status,'failed');assert.ok(f.writes[0].next_attempt_at);assert.equal(f.writes[0].lease_until,null);
});

test('worker confirms processing results before marking an upload accepted',async()=>{
  const f=fixture();f.admin.rpc=async()=>({data:[]});const original=f.admin.from;
  f.admin.from=table=>{const q=original(table);q.limit=async()=>({data:[{id:'submitted1',request_id:'request1',destination:'unit'}]});return q;};
  const summary=await runGoogleAdsImport(f.admin,{destination:'unit',status:async()=>({requestStatusPerDestination:[{requestStatus:'SUCCESS'}]})});assert.equal(summary.accepted,1);assert.equal(f.writes[0].status,'accepted');assert.ok(f.writes[0].accepted_at);
});
test('worker does not mark a partially failed Google request accepted',async()=>{
  const f=fixture();f.admin.rpc=async()=>({data:[]});const original=f.admin.from;
  f.admin.from=table=>{const q=original(table);q.limit=async()=>({data:[{id:'submitted2',request_id:'request2',destination:'unit'}]});return q;};
  const summary=await runGoogleAdsImport(f.admin,{destination:'unit',status:async()=>({requestStatusPerDestination:[{requestStatus:'PARTIAL_SUCCESS',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_INVALID_GCLID'}]}}]})});assert.equal(summary.accepted,0);assert.equal(f.writes[0].status,'failed');assert.ok(f.writes[0].next_attempt_at);
});
