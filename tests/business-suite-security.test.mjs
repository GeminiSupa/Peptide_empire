import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canManageBusiness,normalizeBusinessItems,validatedQuotePrices} from '../src/lib/businessSuite.mjs';
import {canOwnReturningCustomer} from '../src/lib/salesAgentAffiliate.mjs';
import {buildBusinessQuoteRequestEmail} from '../src/lib/businessAccountEmail.mjs';

function sourceFunctions(path,names,dependencies){
  const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export (?=(?:async )?function)/g,'');
  return new Function(...Object.keys(dependencies),`${source}\nreturn {${names.join(',')}};`)(...Object.values(dependencies));
}
const business={id:'company',email:'owner@test',member_role:'buyer',status:'approved',legal_name:'Test Company'};
const customerDependencies=(overrides={})=>({
  businessCustomer:async()=>({admin:{},business,email:'buyer@test'}),
  businessError:(message,status=400)=>Object.assign(new Error(message),{status}),
  businessFailure:error=>Response.json({error:error.message},{status:error.status||503}),
  canManageBusiness,normalizeBusinessItems,rateLimit:()=>true,queueBusinessEmail:async()=>({sent:true}),buildBusinessQuoteRequestEmail,getPublicSiteUrl:()=>'https://example.invalid',...overrides,
});
const post=body=>new Request('https://example.invalid/api/account/business/suite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('company buyers cannot invite or remove teammates',async()=>{
  const {POST}=sourceFunctions('src/app/api/account/business/suite/route.js',['POST'],customerDependencies());
  assert.equal((await POST(post({action:'add-member',email:'other@test.invalid'}))).status,403);
  assert.equal((await POST(post({action:'remove-member',id:'member'}))).status,403);
});
test('managers cannot promote buyers to managers or modify another company membership',async()=>{
  const writes=[];
  const admin={from(table){if(table==='order_claim_blocklist')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:null};}};return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:null};},insert(row){writes.push(row);return this;},async single(){return {data:{id:'new-member',...writes.at(-1)}};}};}};
  const {POST}=sourceFunctions('src/app/api/account/business/suite/route.js',['POST'],customerDependencies({businessCustomer:async()=>({admin,business:{...business,member_role:'manager'},email:'manager@test'})}));
  const result=await POST(post({action:'add-member',email:'employee@example.invalid',role:'manager',business_id:'other'}));
  assert.equal(result.status,200);assert.equal(writes[0].role,'buyer');assert.equal(writes[0].business_id,'company');
});
test('a member email owned by a different company cannot be invited',async()=>{
  const admin={from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='business_members'?{id:'existing',business_id:'other',role:'buyer'}:null};}};}};
  const {POST}=sourceFunctions('src/app/api/account/business/suite/route.js',['POST'],customerDependencies({businessCustomer:async()=>({admin,business:{...business,member_role:'manager'},email:'manager@test'})}));
  assert.equal((await POST(post({action:'add-member',email:'employee@example.invalid'}))).status,409);
});
test('a buyer cannot delete another company shopping list',async()=>{
  const filters=[];
  const admin={from(table){assert.equal(table,'business_saved_lists');return {delete(){return this;},eq(key,value){filters.push([key,value]);return this;},async select(){return {data:[]};}};}};
  const {POST}=sourceFunctions('src/app/api/account/business/suite/route.js',['POST'],customerDependencies({businessCustomer:async()=>({admin,business,email:'buyer@test'})}));
  assert.equal((await POST(post({action:'delete-list',id:'other-list'}))).status,404);
  assert.ok(filters.some(([key,value])=>key==='business_id'&&value==='company'));
  assert.ok(filters.some(([key,value])=>key==='created_by_email'&&value==='buyer@test'));
});
test('pending businesses cannot request approved quotes',async()=>{
  const {POST}=sourceFunctions('src/app/api/account/business/suite/route.js',['POST'],customerDependencies({businessCustomer:async()=>({admin:{},business:{...business,status:'pending'},email:'buyer@test'})}));
  assert.equal((await POST(post({action:'request-quote',items:[{product:'A',qty:1}],status:'approved',unit_price_usd:0}))).status,403);
});
test('a quote request ignores posted approval/prices and alerts both team inboxes',async()=>{
  const writes=[];const messages=[];
  const admin={from(table){return {insert(row){writes.push([table,row]);return this;},select(){return this;},async single(){return {data:{id:'quote',...writes.at(-1)[1]}};},then(resolve){return Promise.resolve({}).then(resolve);}};}};
  const {POST}=sourceFunctions('src/app/api/account/business/suite/route.js',['POST'],customerDependencies({
    businessCustomer:async()=>({admin,business,email:'buyer@test'}),BUSINESS_SIGNUP_RECIPIENTS:['omerforce@gmail.com','info@peptidescostarica.net'],queueBusinessEmail:async(_admin,_company,message)=>{messages.push(message);return {sent:true};},
  }));
  const response=await POST(post({action:'request-quote',business_id:'other',items:[{product:'A',qty:2,unit_price_usd:0}],status:'approved'}));
  assert.equal(response.status,200);
  const inserted=writes.find(([table])=>table==='business_quotes')[1];
  assert.equal(inserted.business_id,'company');assert.equal(inserted.status,undefined);assert.deepEqual(inserted.items,[{product:'A',qty:2}]);
  assert.deepEqual(messages.map(message=>message.recipient).sort(),['buyer@test','info@peptidescostarica.net','omerforce@gmail.com']);
  const confirmation=messages.find(message=>message.recipient==='buyer@test');
  assert.match(confirmation.html,/Recibimos su solicitud de cotización/);
  assert.match(confirmation.body,/2 × A/);
});
test('server rejects used quotes and only queries the authenticated company',async()=>{
  const calls=[];
  const approved={id:'q',business_id:'company',status:'approved',expires_at:new Date(Date.now()+86400000).toISOString(),items:[{product:'A',qty:1,unit_price_usd:10}]};
  const admin={from(table){return {select(){return this;},eq(key,value){calls.push([table,key,value]);return this;},async maybeSingle(){return {data:approved};},async limit(){return {data:[{id:'already-used'}]};}};}};
  const {resolveBusinessQuote}=sourceFunctions('src/lib/businessSuiteServer.js',['resolveBusinessQuote'],{validatedQuotePrices});
  await assert.rejects(()=>resolveBusinessQuote(admin,business,'q',[{product:'A',qty:1}]),/already has an order/);
  assert.ok(calls.some(([table,key,value])=>table==='business_quotes'&&key==='business_id'&&value==='company'));
});
test('business attribution is server-derived and clears competing affiliate payouts',async()=>{
  const admin={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{user_id:'rep',name:'Agent',tier:'staff',status:'active'}};}};}};
  const {applyBusinessOrderAttribution}=sourceFunctions('src/lib/businessSuiteServer.js',['applyBusinessOrderAttribution'],{canOwnReturningCustomer});
  const result=await applyBusinessOrderAttribution(admin,{sales_agent:'spoof',affiliate_id:'affiliate',affiliate_commission_usd:50},{...business,rep_user_id:'rep',rep_commission_pct:12,corporation_number:'3101999999'},null,{contractApplied:true,businessSavings:30});
  assert.equal(result.sales_agent,'Agent');assert.equal(result.affiliate_id,null);assert.equal(result.affiliate_commission_usd,0);assert.equal(result.agent_commission_rate_override,12);assert.equal(result.agent_commission_source,'business_account');assert.equal(result.business_snapshot.corporation_number,'3101999999');assert.equal(result.business_account_id,'company');
});
test('suspended reps receive no business commission while orders remain placeable',async()=>{
  const admin={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{user_id:'rep',name:'Agent',tier:'staff',status:'suspended'}};}};}};
  const {applyBusinessOrderAttribution}=sourceFunctions('src/lib/businessSuiteServer.js',['applyBusinessOrderAttribution'],{canOwnReturningCustomer});
  const result=await applyBusinessOrderAttribution(admin,{sales_agent:'spoof'},{...business,rep_user_id:'rep',rep_commission_pct:12},null,{});
  assert.equal(result.sales_agent,null);assert.equal(result.agent_commission_rate_override,0);
});
test('claimed email jobs cannot be delivered twice',async()=>{
  let sends=0;let claimed=false;
  const writes=[];
  const admin={async rpc(){if(claimed)return {data:[]};claimed=true;return {data:[{id:'mail',recipient:'buyer@test',subject:'Approved',body:'Test'}]};},from(){return {update(value){writes.push(value);return this;},async eq(){return {};}};}};
  const {deliverBusinessEmail}=sourceFunctions('src/lib/businessSuiteServer.js',['deliverBusinessEmail'],{
    getOrderMailSettings:()=>({smtp:{configured:true},from:'store@test'}),isOwnDomainAddress:()=>false,
    nodemailer:{createTransport:()=>({async sendMail(){sends++;return {rejected:[]};}})},
  });
  assert.equal((await deliverBusinessEmail(admin,'mail')).sent,true);
  assert.equal((await deliverBusinessEmail(admin,'mail')).sent,false);
  assert.equal(sends,1);assert.equal(writes[0].status,'sent');
});
test('email delivery failures leave a durable retryable record',async()=>{
  const writes=[];
  const admin={async rpc(){return {data:[{id:'mail',recipient:'buyer@test',subject:'Approved',body:'Test'}]};},from(){return {update(value){writes.push(value);return this;},async eq(){return {};}};}};
  const {deliverBusinessEmail}=sourceFunctions('src/lib/businessSuiteServer.js',['deliverBusinessEmail'],{
    getOrderMailSettings:()=>({smtp:{configured:true},from:'store@test'}),isOwnDomainAddress:()=>false,
    nodemailer:{createTransport:()=>({async sendMail(){throw new Error('Test transport failure');}})},
  });
  assert.equal((await deliverBusinessEmail(admin,'mail')).sent,false);assert.equal(writes[0].status,'failed');assert.equal(writes[0].last_error,'Test transport failure');
});
test('billing downloads cannot read an order from a different company',async()=>{
  const filters=[];
  const admin={from(){return {select(){return this;},eq(key,value){filters.push([key,value]);return this;},async maybeSingle(){return {data:null};}};}};
  const {GET}=sourceFunctions('src/app/api/account/business/invoice/route.js',['GET'],customerDependencies({businessCustomer:async()=>({admin,business,email:'buyer@test'})}));
  assert.equal((await GET(new Request('https://example.invalid/api/account/business/invoice?order=other-order'))).status,404);
  assert.ok(filters.some(([key,value])=>key==='business_account_id'&&value==='company'));
});
