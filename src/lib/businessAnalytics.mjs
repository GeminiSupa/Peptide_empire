const DAY = 86400000;
import {orderCountsAsSale,orderNetRevenueUsd} from './orderRevenue.mjs';
const FEATURE_LABELS = {
  dashboard_viewed: 'Account dashboard', tools_viewed: 'Business tools', tool_tab_viewed: 'Tool tabs',
  checkout_started: 'Checkout starts', list_created: 'Saved lists', quote_requested: 'Quote requests',
  member_invited: 'Team invites', invoice_downloaded: 'Billing downloads', language_changed: 'Language changes',
};

function isoDay(value) { const date=new Date(value); return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):null; }
function itemLines(value) { return Array.isArray(value)?value:[]; }

function roundMoney(value){return Math.round((Number(value)||0)*100)/100;}
function within(value,days,now){const time=Date.parse(value);return Number.isFinite(time)&&now-time<=days*DAY;}
function firstPhone(row){return String(row.owner_whatsapp||row.phone||'').replace(/[^0-9+]/g,'');}

export function buildBusinessAnalytics({ businesses=[], events=[], orders=[], quotes=[], lists=[], members=[], intelligence=[] }, now=Date.now()) {
  const byBusiness=new Map(businesses.map(row=>[row.id,{...row,events:[],orders:[],quotes:[],lists:[],members:[]} ]));
  for(const [name,rows] of Object.entries({events,orders,quotes,lists,members})) for(const row of rows) byBusiness.get(name==='orders'?row.business_account_id:row.business_id)?.[name].push(row);
  const productInterest=new Map();
  const featureCounts=new Map();
  const daily=new Map();
  for(const event of events){
    featureCounts.set(event.event_type,(featureCounts.get(event.event_type)||0)+1);
    const day=isoDay(event.occurred_at); if(day)daily.set(day,(daily.get(day)||0)+1);
    for(const product of itemLines(event.metadata?.products)) productInterest.set(product,(productInterest.get(product)||0)+1);
  }
  const intelByBusiness=new Map(intelligence.map(row=>[row.business_id,row]));
  const accounts=[...byBusiness.values()].map(row=>{
    const sorted=[...row.events].sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at));
    const paid=row.orders.filter(order=>orderCountsAsSale(order));
    const lastEvent=sorted[0]?.occurred_at||null;
    const lastOrder=[...row.orders].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]?.created_at||null;
    const lastActive=[lastEvent,lastOrder].filter(Boolean).sort().at(-1)||null;
    const active7=row.events.filter(event=>now-Date.parse(event.occurred_at)<=7*DAY);
    const active30=row.events.filter(event=>now-Date.parse(event.occurred_at)<=30*DAY);
    const uniqueMembers30=new Set(active30.map(event=>event.member_email)).size;
    const checkoutStarts=row.events.filter(event=>event.event_type==='checkout_started').length;
    const quoteRequests=row.quotes.length;
    const revenueLifetime=roundMoney(paid.reduce((sum,order)=>sum+orderNetRevenueUsd(order),0));
    const paid30=paid.filter(order=>within(order.created_at,30,now));
    const paid90=paid.filter(order=>within(order.created_at,90,now));
    const revenue30=roundMoney(paid30.reduce((sum,order)=>sum+orderNetRevenueUsd(order),0));
    const revenue90=roundMoney(paid90.reduce((sum,order)=>sum+orderNetRevenueUsd(order),0));
    const aov=paid.length?roundMoney(revenueLifetime/paid.length):0;
    const lastOrderValue=paid.length?roundMoney(orderNetRevenueUsd([...paid].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0])):0;
    const memberActivity=row.members.filter(member=>member.active!==false).map(member=>{const activity=sorted.find(event=>event.member_email===member.email);return {email:member.email,role:member.role,last_active_at:activity?.occurred_at||null,events_30d:active30.filter(event=>event.member_email===member.email).length};}).sort((a,b)=>(Date.parse(b.last_active_at)||0)-(Date.parse(a.last_active_at)||0));
    const intel=intelByBusiness.get(row.id)||{};
    let health='never_activated';
    if(paid.length>0 && lastActive && now-Date.parse(lastActive)<=30*DAY) health='customer';
    else if(active7.length>0||checkoutStarts>0||quoteRequests>0) health='evaluating';
    else if(lastActive && now-Date.parse(lastActive)>30*DAY) health='at_risk';
    else if(lastActive) health='active';
    const eventCounts=Object.fromEntries([...new Set(row.events.map(event=>event.event_type))].map(type=>[type,row.events.filter(event=>event.event_type===type).length]));
    let score=15;
    if(lastActive)score+=15;if(active7.length)score+=15;else if(active30.length)score+=8;
    if(checkoutStarts||quoteRequests)score+=10;if(paid.length)score+=20;if(paid.length>1)score+=10;if(revenueLifetime>=1000)score+=10;if(revenueLifetime>=5000)score+=5;
    score=Math.min(100,score);
    const highIntent=!paid.length&&(checkoutStarts>=2||quoteRequests>0||row.lists.length>0);
    const checkoutAfterOrder=sorted.find(event=>event.event_type==='checkout_started'&&(!lastOrder||Date.parse(event.occurred_at)>Date.parse(lastOrder)));
    const followUpDue=Boolean(intel.next_follow_up_at&&Date.parse(intel.next_follow_up_at)<=now);
    let nextAction='Monitor account';
    if(followUpDue)nextAction='Follow-up is due';else if(!lastActive&&now-Date.parse(row.created_at)>7*DAY)nextAction='Send onboarding message';else if(highIntent)nextAction='Contact high-intent account';else if(checkoutAfterOrder)nextAction='Recover recent checkout';else if(health==='at_risk')nextAction='Re-engage inactive customer';else if(paid.length===1)nextAction='Encourage second order';else if(paid.length>1)nextAction='Review loyalty opportunity';
    return {id:row.id,legal_name:row.legal_name,trading_name:row.trading_name,email:row.email,phone:firstPhone(row),contact_name:row.contact_name,preferred_language:row.preferred_language,rep_user_id:row.rep_user_id,status:row.status,created_at:row.created_at,last_active_at:lastActive,last_order_at:lastOrder,health,score,events_7d:active7.length,events_30d:active30.length,active_members_30d:uniqueMembers30,total_members:memberActivity.length,members:memberActivity,paid_orders:paid.length,orders_30d:paid30.length,orders_90d:paid90.length,revenue_lifetime:revenueLifetime,revenue_30d:revenue30,revenue_90d:revenue90,average_order_value:aov,last_order_value:lastOrderValue,checkout_starts:checkoutStarts,quotes:quoteRequests,lists:row.lists.length,high_intent:highIntent,checkout_recovery:Boolean(checkoutAfterOrder),follow_up_due:followUpDue,next_action:nextAction,lifecycle_stage:intel.lifecycle_stage||'',priority:intel.priority||'normal',tags:Array.isArray(intel.tags)?intel.tags:[],internal_note:intel.internal_note||'',next_follow_up_at:intel.next_follow_up_at||null,last_contacted_at:intel.last_contacted_at||null,last_contacted_channel:intel.last_contacted_channel||'',event_counts:eventCounts,timeline:sorted.slice(0,20)};
  });
  const approved=accounts.filter(row=>row.status==='approved');
  const active30=approved.filter(row=>row.last_active_at&&now-Date.parse(row.last_active_at)<=30*DAY);
  const activated=approved.filter(row=>row.last_active_at);
  const checkout=approved.filter(row=>row.checkout_starts>0);
  const ordered=approved.filter(row=>row.paid_orders>0);
  const quoteConverted=new Set(orders.filter(order=>order.business_quote_id).map(order=>order.business_quote_id));
  const revenueLifetime=roundMoney(accounts.reduce((sum,row)=>sum+row.revenue_lifetime,0));
  const revenue30=roundMoney(accounts.reduce((sum,row)=>sum+row.revenue_30d,0));
  const revenue90=roundMoney(accounts.reduce((sum,row)=>sum+row.revenue_90d,0));
  const paidOrders=accounts.reduce((sum,row)=>sum+row.paid_orders,0);
  const alerts=accounts.filter(row=>row.follow_up_due||row.high_intent||row.checkout_recovery||row.health==='at_risk'||(!row.last_active_at&&now-Date.parse(row.created_at)>7*DAY)).sort((a,b)=>(b.follow_up_due-a.follow_up_due)||(b.high_intent-a.high_intent)||(b.score-a.score)).map(row=>({id:row.id,legal_name:row.legal_name,kind:row.follow_up_due?'follow_up':row.high_intent?'high_intent':row.checkout_recovery?'checkout':row.health==='at_risk'?'at_risk':'onboarding',label:row.next_action,contact_name:row.contact_name,email:row.email,phone:row.phone,priority:row.priority}));
  return {
    summary:{approved:approved.length,active_7d:approved.filter(row=>row.last_active_at&&now-Date.parse(row.last_active_at)<=7*DAY).length,active_30d:active30.length,never_activated:approved.filter(row=>!row.last_active_at).length,at_risk:approved.filter(row=>row.health==='at_risk').length,engagement_rate:approved.length?Math.round(active30.length/approved.length*100):0,revenue_lifetime:revenueLifetime,revenue_30d:revenue30,revenue_90d:revenue90,average_order_value:paidOrders?roundMoney(revenueLifetime/paidOrders):0,repeat_buyers:accounts.filter(row=>row.paid_orders>1).length,high_intent:accounts.filter(row=>row.high_intent).length,follow_ups_due:accounts.filter(row=>row.follow_up_due).length},
    funnel:[{key:'approved',label:'Approved accounts',value:approved.length},{key:'activated',label:'Activated',value:activated.length},{key:'checkout',label:'Started checkout',value:checkout.length},{key:'ordered',label:'Paid order',value:ordered.length}],
    quote_conversion:{requested:quotes.length,converted:quotes.filter(quote=>quoteConverted.has(quote.id)).length},
    features:[...featureCounts.entries()].filter(([key])=>FEATURE_LABELS[key]).map(([key,value])=>({key,label:FEATURE_LABELS[key],value,accounts:new Set(events.filter(event=>event.event_type===key).map(event=>event.business_id)).size})).sort((a,b)=>b.value-a.value),
    activity_by_day:[...daily.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-90).map(([date,value])=>({date,value})),
    product_interest:[...productInterest.entries()].map(([product,value])=>({product,value})).sort((a,b)=>b.value-a.value).slice(0,15),
    alerts,
    accounts:accounts.sort((a,b)=>(Date.parse(b.last_active_at)||0)-(Date.parse(a.last_active_at)||0)),
  };
}
