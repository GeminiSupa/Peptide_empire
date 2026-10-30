import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBusinessAnalytics} from '../src/lib/businessAnalytics.mjs';

test('business analytics builds funnel, health, adoption and product interest',()=>{
  const now=Date.parse('2026-10-30T12:00:00Z');
  const businesses=[
    {id:'a',legal_name:'Active Labs',status:'approved',created_at:'2026-09-01T00:00:00Z'},
    {id:'b',legal_name:'Quiet Clinic',status:'approved',created_at:'2026-08-01T00:00:00Z'},
    {id:'c',legal_name:'New Pharmacy',status:'approved',created_at:'2026-10-29T00:00:00Z'},
  ];
  const events=[
    {id:'e1',business_id:'a',member_email:'owner@active.test',event_type:'checkout_started',metadata:{products:['Semaglutide']},occurred_at:'2026-10-29T10:00:00Z'},
    {id:'e2',business_id:'a',member_email:'buyer@active.test',event_type:'list_created',metadata:{products:['Semaglutide','BPC-157']},occurred_at:'2026-10-28T10:00:00Z'},
    {id:'e3',business_id:'b',member_email:'owner@quiet.test',event_type:'dashboard_viewed',metadata:{},occurred_at:'2026-08-15T10:00:00Z'},
  ];
  const quotes=[{id:'q1',business_id:'a'}];
  const orders=[{id:'o1',business_account_id:'a',business_quote_id:'q1',status:'Paid',created_at:'2026-10-29T11:00:00Z'}];
  const members=[{business_id:'a',active:true},{business_id:'a',active:true},{business_id:'b',active:true}];
  const analytics=buildBusinessAnalytics({businesses,events,orders,quotes,lists:[],members},now);
  assert.deepEqual(analytics.funnel.map(step=>step.value),[3,2,1,1]);
  assert.equal(analytics.summary.active_30d,1);
  assert.equal(analytics.summary.never_activated,1);
  assert.equal(analytics.summary.at_risk,1);
  assert.deepEqual(analytics.quote_conversion,{requested:1,converted:1});
  assert.equal(analytics.accounts.find(row=>row.id==='a').health,'customer');
  assert.equal(analytics.accounts.find(row=>row.id==='a').active_members_30d,2);
  assert.deepEqual(analytics.product_interest[0],{product:'Semaglutide',value:2});
});
