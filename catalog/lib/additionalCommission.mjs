// Copied from the catalog (src/lib/additionalCommission.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
import {canOwnReturningCustomer} from './salesAgentAffiliate.mjs';
import {findActiveProfile, sameOwner} from './orderOwnership.mjs';
import {orderCountsAsSale} from './orderRevenue.mjs';
import {stampOverrideOrder,readOverrideStamp} from './subUserCommission.mjs';
import {commissionClawback} from './orderRefund.mjs';

export const ADDITIONAL_COMMISSION_FIELDS=['additional_commission_user_id','additional_commission_pct','additional_commission_reason'];

export function planAdditionalCommission(order,updates,profiles,now=new Date().toISOString()){
  const requested=ADDITIONAL_COMMISSION_FIELDS.some(key=>Object.hasOwn(updates,key));
  if(!requested)return {ok:true,changed:false,patch:{}};
  const userId=String(Object.hasOwn(updates,'additional_commission_user_id')?(updates.additional_commission_user_id||''):(order.additional_commission_user_id||'')).trim();
  const rate=userId?Number(updates.additional_commission_pct??order.additional_commission_pct):null;
  const reason=String(updates.additional_commission_reason??order.additional_commission_reason??'').trim();
  const changed=userId!==String(order.additional_commission_user_id||'')||Number(rate||0)!==Number(order.additional_commission_pct||0)||reason!==String(order.additional_commission_reason||'');
  if(!changed)return {ok:true,changed:false,patch:{}};
  if(reason.length<5||reason.length>500)return {ok:false,error:'Enter a short note (5–500 characters) explaining the extra commission or its removal.'};
  const recipient=userId?(profiles||[]).find(row=>row.user_id===userId):null;
  if(userId&&(!Number.isFinite(rate)||rate<=0||rate>100))return {ok:false,error:'Extra commission must be greater than 0 and no more than 100%.'};
  if(userId&&!canOwnReturningCustomer(recipient))return {ok:false,error:'Choose an active team member for the extra commission.'};
  const owner=findActiveProfile(profiles,order.sales_agent);
  if(userId&&(owner?.user_id===userId||(order.sales_agent&&(sameOwner(order.sales_agent,recipient.name)||sameOwner(order.sales_agent,recipient.email)))))return {ok:false,error:'The extra commission must go to a different team member. Use the agent commission control to change the owner’s rate.'};
  const rateChanged=userId!==String(order.additional_commission_user_id||'')||Number(rate||0)!==Number(order.additional_commission_pct||0);
  return {ok:true,changed:true,rateChanged,recipient,patch:{additional_commission_user_id:userId||null,additional_commission_pct:rate,additional_commission_reason:userId?reason:null,additional_commission_assigned_at:userId?(rateChanged?now:order.additional_commission_assigned_at):null},message:userId?`Additional commission: ${recipient.name||recipient.email} ${rate}% alongside ${order.sales_agent||'the credited agent'} — ${reason}`:`Additional commission removed — ${reason}`};
}

export function additionalCommissionOrders(orders,profile,{startMs=-Infinity,endMs=Infinity,reportableAt=order=>Date.parse(order.created_at),isPaid=()=>false}={}){
  if(!canOwnReturningCustomer(profile))return [];
  return (orders||[]).filter(order=>{
    const rate=Number(order.additional_commission_pct);
    const at=Math.max(reportableAt(order),Date.parse(order.additional_commission_assigned_at||order.created_at));
    return order.additional_commission_user_id===profile.user_id&&rate>0&&rate<=100&&orderCountsAsSale(order)&&at>=startMs&&at<=endMs&&!isPaid(order);
  }).map(order=>({...stampOverrideOrder(order,{rate:Number(order.additional_commission_pct),name:`Extra commission · ${order.sales_agent||'House sale'}`,kind:'additional_commission'}),commission_additional_user_id:profile.user_id,commission_additional_rate:Number(order.additional_commission_pct)}));
}

export function mergeAdditionalCommissionOrders(base,extras){
  const rows=new Map((base||[]).map(order=>[order.id,order]));
  for(const extra of extras||[]){
    const current=rows.get(extra.id);
    const baseRate=current?(current.commission_additional_user_id?Number(current.commission_additional_base_rate||0):Number(readOverrideStamp(current)?.rate||0)):0;
    rows.set(extra.id,{...extra,commission_override_rate:baseRate+Number(extra.commission_additional_rate),commission_override_name:current?`${current.commission_override_name||'Team cut'} + extra commission`:extra.commission_override_name,commission_additional_base_rate:baseRate});
  }
  return [...rows.values()];
}
export function additionalCommissionClawbacks(payouts,order,plan){
  const cuts=new Map();
  for(const payout of payouts||[]){
    const saved=(payout.override_orders_data||[]).find(row=>row.id===order.id&&row.commission_additional_user_id);
    if(!saved||!payout.agent_email||cuts.has(payout.agent_email.toLowerCase()))continue;
    const rate=Number(saved.commission_override_rate);
    if(!Number.isFinite(rate)||rate<=0)continue;
    cuts.set(payout.agent_email.toLowerCase(),{agent_email:payout.agent_email,agent_name:payout.agent_name,rate,...commissionClawback(plan,{rate,alreadyPaid:true})});
  }
  return [...cuts.values()];
}

export function additionalCommissionSnapshotMatches(liveOrders,savedOrders){
  const current=new Map((liveOrders||[]).map(order=>[order.id,order]));
  return (savedOrders||[]).every(saved=>{
    if(!saved.commission_additional_user_id)return true;
    const live=current.get(saved.id);
    if(!live)return true; // refunded/cancelled orders drop out rather than earning
    return live.additional_commission_user_id===saved.commission_additional_user_id&&Number(live.additional_commission_pct)===Number(saved.commission_additional_rate);
  });
}
