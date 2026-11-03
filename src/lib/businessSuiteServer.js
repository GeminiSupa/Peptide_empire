import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { readBearerToken } from '@/lib/customerOrderOwnership.mjs';
import { findBusinessAccount } from '@/lib/businessAccounts.mjs';
import { validatedQuotePrices } from '@/lib/businessSuite.mjs';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import { getOrderMailSettings } from '@/lib/transactionalSmtp';
import { getOwnDomainSmtpConfig, isOwnDomainAddress } from '@/lib/ownDomainSmtp.mjs';
import nodemailer from 'nodemailer';
import { businessEmailAttachments } from '@/lib/businessAccountEmail.mjs';
import { writeDroppingMissingColumns } from '@/lib/optionalColumns.mjs';
import { canOwnReturningCustomer } from '@/lib/salesAgentAffiliate.mjs';
import { firstOrderExtraArmed, planFirstOrderExtra } from '@/lib/businessFirstOrderExtra.mjs';

export function businessError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export function businessFailure(error) {
  console.error('[business-suite]',error.message);
  return Response.json({ error: error.status ? error.message : 'Business services are temporarily unavailable. Please try again.' }, { status: error.status || 503 });
}
export async function businessCustomer(request, { optional = false } = {}) {
  const admin = getSupabaseAdmin();
  let token;
  try { token = readBearerToken(request.headers.get('authorization')); } catch { throw businessError('Sign in required.',401); }
  if (!token) throw businessError('Sign in required.',401);
  const { data,error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email_confirmed_at || !data.user.email) throw businessError('Verified sign-in required.',401);
  const email = data.user.email.toLowerCase().trim();
  const business = await findBusinessAccount(admin,email);
  if (!business && !optional) throw businessError('Business account not found.',404);
  return { admin, user: data.user, email, business };
}
export async function businessProductPrices(admin, business) {
  if (!business || business.status !== 'approved') return [];
  const result = await admin.from('business_product_prices').select('id,product,unit_price_usd').eq('business_id',business.id);
  if (result.error && ['42P01','PGRST205'].includes(result.error.code)) return [];
  if (result.error) throw result.error;
  return result.data || [];
}
export function publicBusiness(business, product_prices = []) {
  if (!business) return null;
  // What the team earns on this account never reaches the customer: not the
  // rep's commission, and not the one-time extra set for another team member.
  const {
    rep_commission_pct: _commission, rep_user_id: _rep,
    first_order_extra_user_id: _extraUser, first_order_extra_pct: _extraPct,
    first_order_extra_used_at: _extraUsed, first_order_extra_order_number: _extraOrder,
    ...customer
  } = business;
  return { ...customer, product_prices };
}
export async function resolveBusinessQuote(admin, business, quoteId, items) {
  if (!quoteId) return null;
  if (!business || business.status !== 'approved') throw businessError('An approved business account is required for this quote.',403);
  const result = await admin.from('business_quotes').select('*').eq('id',quoteId).eq('business_id',business.id).maybeSingle();
  if (result.error) throw result.error;
  let prices;
  try { prices = validatedQuotePrices(result.data,business.id,items); } catch (error) { throw businessError(error.message,409); }
  const used = await admin.from('orders').select('id').eq('business_quote_id',quoteId).limit(1);
  if (used.error) throw used.error;
  if (used.data?.length) throw businessError('This quote already has an order. Open the existing order to continue.',409);
  return { quote: result.data, prices };
}
export async function validatedBusinessRep(admin, userId) {
  if (!userId) return null;
  const result = await admin.from('admin_profiles').select('user_id,name,email,status,tier,is_superadmin').eq('user_id',userId).maybeSingle();
  if (result.error) throw result.error;
  const profile = result.data;
  if (!canOwnReturningCustomer(profile)) throw businessError('Choose an active sales team member.');
  return profile;
}
export async function applyBusinessOrderAttribution(admin,order,business,quote,pricing,contractPrices=[]) {
  if(!business) return order;
  const snapshot={legal_name:business.legal_name,trading_name:business.trading_name,corporation_number:business.corporation_number,billing_address:business.billing_address,email:business.email,rep_user_id:business.rep_user_id || null,rep_commission_pct:Number(business.rep_commission_pct || 0),discount_pct:business.status==='approved'?Number(business.discount_pct || 0):0,product_prices:contractPrices.map(row=>({product:row.product,unit_price_usd:row.unit_price_usd})),contract_applied:Boolean(pricing.contractApplied),business_savings:Number(pricing.businessSavings || 0)};
  const stamped={...order,business_account_id:business.id,business_snapshot:snapshot,...(quote?{business_quote_id:quote.id}:{})};
  if(!business.rep_user_id) return stamped;
  let rep;
  try { rep=await validatedBusinessRep(admin,business.rep_user_id); }
  catch(error) { if(error.status!==400) throw error; }
  return {...stamped,sales_agent:rep?(rep.name || rep.email):null,agent_commission_source:'business_account',agent_commission_rate_override:rep?Number(business.rep_commission_pct || 0):0,affiliate_id:null,affiliate_commission_usd:0,affiliate_commission_crc:0};
}
/**
 * Takes a business's one-time extra commission for the order about to be saved.
 *
 * The setting is claimed with a single conditional update (only while it is
 * still unused), so two orders placed at the same moment cannot both carry it.
 * Returns the fields to stamp on the order, or null when there is nothing to
 * apply. Never throws: a sale is worth more than the commission note, and a
 * problem raises an admin notification so the extra can be added by hand.
 */
export async function claimFirstOrderExtraCommission(admin, order, business) {
  if (!firstOrderExtraArmed(business)) return null;
  const warn = async (reason) => {
    console.error('[orders/create] First-order extra commission not applied:', reason);
    try {
      await admin.from('admin_notifications').insert({
        type: 'first_order_extra_skipped',
        title: `Extra commission not applied: ${order.order_number}`,
        body: `${business.legal_name} — ${reason}. Add the one-time extra by hand in Order Details.`.slice(0, 500),
        link_tab: 'orders',
        link_ref: order.order_number,
      });
    } catch { /* notification table may not exist yet */ }
    return null;
  };
  try {
    const { data: profiles, error: profileError } = await admin.from('admin_profiles').select('user_id,name,email,tier,status,is_superadmin');
    if (profileError) return await warn(profileError.message);
    const plan = planFirstOrderExtra({ business, order, profiles });
    if (!plan.apply) return plan.skipped ? await warn(plan.skipped) : null;
    const claimed = await admin.from('business_accounts')
      .update({ first_order_extra_used_at: plan.activity.at, first_order_extra_order_number: order.order_number })
      .eq('id', business.id)
      .eq('first_order_extra_user_id', business.first_order_extra_user_id)
      .is('first_order_extra_used_at', null)
      .select('id')
      .maybeSingle();
    if (claimed.error) return await warn(claimed.error.message);
    // Another order took it between our read and this update.
    if (!claimed.data) return null;
    return { patch: plan.patch, activity: plan.activity };
  } catch (error) {
    return await warn(error.message);
  }
}
/** Hands the extra back when the order it was taken for could not be saved. */
export async function releaseFirstOrderExtraCommission(admin, business, orderNumber) {
  try {
    const released = await admin.from('business_accounts')
      .update({ first_order_extra_used_at: null, first_order_extra_order_number: null })
      .eq('id', business.id)
      .eq('first_order_extra_order_number', orderNumber);
    if (released.error) console.error('[orders/create] Could not release the first-order extra:', released.error.message);
  } catch (error) {
    console.error('[orders/create] Could not release the first-order extra:', error.message);
  }
}
export async function referralBusinessPatch(admin, value) {
  const code = String(value || '').toUpperCase().trim();
  if (!code) return {};
  if (!/^[A-Z0-9_-]{4,40}$/.test(code)) throw businessError('Invalid business referral code.');
  const result = await admin.from('business_referral_codes').select('code,rep_user_id').eq('code',code).eq('active',true).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw businessError('This referral code is no longer active. Contact our team for help.');
  await validatedBusinessRep(admin,result.data.rep_user_id);
  return { referral_code: code, rep_user_id: result.data.rep_user_id };
}
export async function deliverBusinessEmail(admin, id) {
  const claim = await admin.rpc('claim_business_email',{ mail_id: id });
  if (claim.error) throw claim.error;
  const row = claim.data?.[0];
  if (!row) return { id, sent: false, alreadyClaimed: true };
  try {
    const settings = getOrderMailSettings();
    const own = isOwnDomainAddress(row.recipient) ? getOwnDomainSmtpConfig() : null;
    const smtp = own || settings.smtp;
    if (!smtp.configured) throw new Error('Email delivery is not configured.');
    const result = await nodemailer.createTransport({ host:smtp.host,port:smtp.port,secure:smtp.secure,auth:{user:smtp.user,pass:smtp.pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000 }).sendMail({ from:own?.from || settings.from,to:row.recipient,subject:row.subject,text:row.body,...(row.html?{html:row.html,attachments:businessEmailAttachments(row.html)}:{}) });
    if (result.rejected?.length) throw new Error('The recipient was rejected by the mail provider.');
    const saved = await admin.from('business_email_outbox').update({status:'sent',last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id);
    if (saved.error) throw saved.error;
    return {id,sent:true};
  } catch (error) {
    await admin.from('business_email_outbox').update({status:'failed',last_error:String(error.message).slice(0,500),updated_at:new Date().toISOString()}).eq('id',row.id);
    return {id,sent:false};
  }
}
// `html` is the branded version. Until business-account-welcome.sql adds the
// column it is dropped and the plain text still goes out.
export async function queueBusinessEmail(admin,business,{key,recipient=business.email,subject,body,html}) {
  try {
  const row={business_id:business.id,event_key:key,recipient,subject,body:`${body}\n\n${getPublicSiteUrl()}/account/business\n\nPeptides Costa Rica`,...(html?{html}:{})};
  const result = await writeDroppingMissingColumns(row,['html'],payload=>admin.from('business_email_outbox').upsert(payload,{onConflict:'event_key',ignoreDuplicates:true}).select('id').maybeSingle());
  if (result.error) throw result.error;
  if (!result.data) {
    const existing=await admin.from('business_email_outbox').select('status').eq('event_key',key).maybeSingle();
    if(existing.error)throw existing.error;
    return {sent:existing.data?.status==='sent',duplicate:true};
  }
  return await deliverBusinessEmail(admin,result.data.id);
  } catch(error) {
    console.error('[business/email-queue]',error.message);
    return {sent:false,queued:false};
  }
}
