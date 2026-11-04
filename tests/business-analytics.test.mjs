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
  const orders=[{id:'o1',business_account_id:'a',business_quote_id:'q1',status:'Paid',total_usd:1200,created_at:'2026-10-29T11:00:00Z'}];
  const members=[{business_id:'a',email:'owner@active.test',active:true},{business_id:'a',email:'buyer@active.test',active:true},{business_id:'b',email:'owner@quiet.test',active:true}];
  const intelligence=[{business_id:'b',lifecycle_stage:'at_risk',priority:'high',tags:['clinic'],next_follow_up_at:'2026-10-29T09:00:00Z',internal_note:'Call the owner'}];
  const analytics=buildBusinessAnalytics({businesses,events,orders,quotes,lists:[{business_id:'b'}],members,intelligence},now);
  assert.deepEqual(analytics.funnel.map(step=>step.value),[3,2,1,1]);
  assert.equal(analytics.summary.active_30d,1);
  assert.equal(analytics.summary.never_activated,1);
  assert.equal(analytics.summary.at_risk,1);
  assert.deepEqual(analytics.quote_conversion,{requested:1,converted:1});
  assert.equal(analytics.accounts.find(row=>row.id==='a').health,'customer');
  assert.equal(analytics.accounts.find(row=>row.id==='a').active_members_30d,2);
  assert.equal(analytics.accounts.find(row=>row.id==='a').revenue_lifetime,1200);
  assert.equal(analytics.accounts.find(row=>row.id==='a').average_order_value,1200);
  assert.equal(analytics.accounts.find(row=>row.id==='a').score,85);
  assert.equal(analytics.accounts.find(row=>row.id==='b').high_intent,true);
  assert.equal(analytics.accounts.find(row=>row.id==='b').follow_up_due,true);
  assert.equal(analytics.accounts.find(row=>row.id==='b').priority,'high');
  assert.equal(analytics.summary.revenue_30d,1200);
  assert.equal(analytics.summary.high_intent,1);
  assert.equal(analytics.summary.follow_ups_due,1);
  assert.equal(analytics.alerts[0].kind,'follow_up');
  assert.deepEqual(analytics.product_interest[0],{product:'Semaglutide',value:2});
});
