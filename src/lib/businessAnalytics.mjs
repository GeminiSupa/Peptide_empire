const DAY = 86400000;
import {orderCountsAsSale} from './orderRevenue.mjs';
const FEATURE_LABELS = {
  dashboard_viewed: 'Account dashboard', tools_viewed: 'Business tools', tool_tab_viewed: 'Tool tabs',
  checkout_started: 'Checkout starts', list_created: 'Saved lists', quote_requested: 'Quote requests',
  member_invited: 'Team invites', invoice_downloaded: 'Billing downloads', language_changed: 'Language changes',
};

function isoDay(value) { const date=new Date(value); return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):null; }
function itemLines(value) { return Array.isArray(value)?value:[]; }

export function buildBusinessAnalytics({ businesses=[], events=[], orders=[], quotes=[], lists=[], members=[] }, now=Date.now()) {
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
    let health='never_activated';
    if(paid.length>0 && lastActive && now-Date.parse(lastActive)<=30*DAY) health='customer';
    else if(active7.length>0||checkoutStarts>0||quoteRequests>0) health='evaluating';
    else if(lastActive && now-Date.parse(lastActive)>30*DAY) health='at_risk';
    else if(lastActive) health='active';
    const eventCounts=Object.fromEntries([...new Set(row.events.map(event=>event.event_type))].map(type=>[type,row.events.filter(event=>event.event_type===type).length]));
    return {id:row.id,legal_name:row.legal_name,status:row.status,created_at:row.created_at,last_active_at:lastActive,last_order_at:lastOrder,health,events_7d:active7.length,events_30d:active30.length,active_members_30d:uniqueMembers30,total_members:row.members.filter(member=>member.active!==false).length,paid_orders:paid.length,checkout_starts:checkoutStarts,quotes:quoteRequests,lists:row.lists.length,event_counts:eventCounts,timeline:sorted.slice(0,20)};
  });
  const approved=accounts.filter(row=>row.status==='approved');
  const active30=approved.filter(row=>row.last_active_at&&now-Date.parse(row.last_active_at)<=30*DAY);
  const activated=approved.filter(row=>row.last_active_at);
  const checkout=approved.filter(row=>row.checkout_starts>0);
  const ordered=approved.filter(row=>row.paid_orders>0);
  const quoteConverted=new Set(orders.filter(order=>order.business_quote_id).map(order=>order.business_quote_id));
  return {
    summary:{approved:approved.length,active_7d:approved.filter(row=>row.last_active_at&&now-Date.parse(row.last_active_at)<=7*DAY).length,active_30d:active30.length,never_activated:approved.filter(row=>!row.last_active_at).length,at_risk:approved.filter(row=>row.health==='at_risk').length,engagement_rate:approved.length?Math.round(active30.length/approved.length*100):0},
    funnel:[{key:'approved',label:'Approved accounts',value:approved.length},{key:'activated',label:'Activated',value:activated.length},{key:'checkout',label:'Started checkout',value:checkout.length},{key:'ordered',label:'Paid order',value:ordered.length}],
    quote_conversion:{requested:quotes.length,converted:quotes.filter(quote=>quoteConverted.has(quote.id)).length},
    features:[...featureCounts.entries()].filter(([key])=>FEATURE_LABELS[key]).map(([key,value])=>({key,label:FEATURE_LABELS[key],value,accounts:new Set(events.filter(event=>event.event_type===key).map(event=>event.business_id)).size})).sort((a,b)=>b.value-a.value),
    activity_by_day:[...daily.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-90).map(([date,value])=>({date,value})),
    product_interest:[...productInterest.entries()].map(([product,value])=>({product,value})).sort((a,b)=>b.value-a.value).slice(0,15),
    accounts:accounts.sort((a,b)=>(Date.parse(b.last_active_at)||0)-(Date.parse(a.last_active_at)||0)),
  };
}
