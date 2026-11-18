import nodemailer from 'nodemailer';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { businessDetails } from '@/lib/businessAccounts.mjs';
import { getOrderMailSettings } from '@/lib/transactionalSmtp';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import { rateLimit } from '@/lib/rateLimit.mjs';
import { buildBusinessAccountEmail, buildBusinessTermsEmail, businessEmailAttachments } from '@/lib/businessAccountEmail.mjs';
import { sendBusinessSignupNotifications } from '@/lib/businessSignupNotifications.mjs';
import { validateBusinessTerms } from '@/lib/businessSuite.mjs';
import { validatedBusinessRep, queueBusinessEmail } from '@/lib/businessSuiteServer';
import { writeDroppingMissingColumns } from '@/lib/optionalColumns.mjs';
import { resolveBusinessEmailAgent } from '@/lib/businessEmailAgent.mjs';
import { missingColumnFrom } from '@/lib/notificationPreferences.mjs';
import { planFirstOrderExtraSetting } from '@/lib/businessFirstOrderExtra.mjs';

export async function GET(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const admin = scopedAdmin(auth.activeSite);
  const { data, error } = await admin.from('business_accounts').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) return Response.json({ error: 'Could not load business accounts.' }, { status: 503 });
  // The WhatsApp number the owner left on their "You" page. Read-only here;
  // a missing column (migration not run) just leaves it blank.
  const emails = (data || []).map(row => row.email);
  const profiles = emails.length ? await admin.from('customer_profiles').select('email,whatsapp_number').in('email', emails) : { data: [] };
  const whatsapp = new Map((profiles.error ? [] : profiles.data || []).map(row => [String(row.email || '').toLowerCase(), row.whatsapp_number || '']));
  return Response.json({ businesses: (data || []).map(row => ({ ...row, owner_whatsapp: whatsapp.get(row.email) || '' })) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const admin = scopedAdmin(auth.activeSite);
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  // Disable / enable from the list. Only the status moves: the company,
  // discount, prices and order history stay, and no email is sent.
  if (body.action === 'set-status') {
    if (!['approved', 'suspended'].includes(body.status)) return Response.json({ error: 'Choose approved or suspended.' }, { status: 400 });
    const { data, error } = await admin.from('business_accounts').update({ status: body.status }).eq('id', body.id).select('*').maybeSingle();
    if (error) return Response.json({ error: 'Could not change the account status. Please try again.' }, { status: 503 });
    if (!data) return Response.json({ error: 'Business not found.' }, { status: 404 });
    return Response.json({ business: data });
  }
  if (body.action === 'invite' || body.action === 'notify') {
    const { data: business, error } = await admin.from('business_accounts').select('*').eq('id', body.id).single();
    if (error || !business) return Response.json({ error: 'Business not found.' }, { status: 404 });
    if (body.action === 'notify') {
      if (!rateLimit(`business-notify:${business.id}`, 2)) return Response.json({ error: 'Please wait before resending staff alerts.' }, { status: 429 });
      const notifications = await sendBusinessSignupNotifications(business);
      return Response.json({ ok: notifications.every(result => result.sent), notifications });
    }
    if (business.status !== 'approved') return Response.json({ error: 'Approve the account before sending the welcome email.' }, { status: 409 });
    if (!rateLimit(`business-invite:${business.id}`, 2)) return Response.json({ error: 'Please wait before sending another welcome email.' }, { status: 429 });
    const { smtp, from } = getOrderMailSettings();
    if (!smtp.host || !smtp.user || !smtp.pass) return Response.json({ error: 'Account saved. Email delivery is not configured.' }, { status: 503 });
    try {
      const agent = await resolveBusinessEmailAgent(admin, business);
      const letter = buildBusinessAccountEmail(business, getPublicSiteUrl(), { agent });
      await nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass } }).sendMail({
        from, to: business.email,
        ...letter,
        attachments: businessEmailAttachments(letter.html),
      });
      const notifications = await sendBusinessSignupNotifications(business, { admin });
      return Response.json({ ok: true, recipient: business.email, notifications });
    } catch { return Response.json({ error: 'Account saved, but the welcome email could not be sent. Please retry.' }, { status: 502 }); }
  }
  let details;
  const email = String(body.email || '').toLowerCase().trim();
  const pct = Number(body.discount_pct);
  try {
    details = { ...businessDetails(body), ...validateBusinessTerms(body) };
    if(details.rep_user_id) await validatedBusinessRep(admin,details.rep_user_id);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid login email is required.');
    if (!['pending', 'approved', 'suspended'].includes(body.status)) throw new Error('Choose a valid status.');
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error('Discount must be between 0 and 100.');
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  const { data: blocked, error: blockError } = await admin.from('order_claim_blocklist').select('email').eq('email', email).maybeSingle();
  if (blockError) return Response.json({ error: 'Could not verify account eligibility.' }, { status: 503 });
  if (blocked) return Response.json({ error: 'Use a dedicated customer email. This address is excluded from customer accounts.' }, { status: 400 });
  const previous=body.id ? await admin.from('business_accounts').select('*').eq('id',body.id).eq('email',email).maybeSingle() : {data:null};
  if(previous.error) return Response.json({error:'Unable to read current business terms.'},{status:503});
  // The one-time extra commission for another team member. Only written when
  // it actually changed, so ordinary edits still save before its migration.
  let extraSetting;
  {
    const wanted = String(body.first_order_extra_user_id || '').trim();
    let profiles = [];
    if (wanted) {
      const result = await admin.from('admin_profiles').select('user_id,name,email,tier,status,is_superadmin');
      if (result.error) return Response.json({ error: 'Could not check the team member for the extra commission.' }, { status: 503 });
      profiles = result.data || [];
    }
    extraSetting = planFirstOrderExtraSetting({ body, previous: previous.data, repUserId: details.rep_user_id, profiles });
    if (!extraSetting.ok) return Response.json({ error: extraSetting.error }, { status: 400 });
  }
  const row = { ...details, ...extraSetting.patch, email, status: body.status, discount_pct: pct, ...(body.preferred_language ? { preferred_language: body.preferred_language === 'en' ? 'en' : 'es' } : {}) };
  // Updates cannot retarget a business to another mailbox accidentally.
  // preferred_language arrives with business-account-welcome.sql.
  const { data, error } = await writeDroppingMissingColumns(row, ['preferred_language'], payload => (body.id
    ? admin.from('business_accounts').update(payload).eq('id', body.id).eq('email', email)
    : admin.from('business_accounts').insert(payload)).select('*').single());
  if (missingColumnFrom(error)?.startsWith('first_order_extra_')) return Response.json({ error: 'The one-time extra commission is not enabled in the database yet. Run add-business-first-order-extra.sql in Supabase first. Nothing was saved.' }, { status: 503 });
  if (error) return Response.json({ error: error.code === '23505' ? 'This email or corporation number is already registered.' : 'Could not save business account. Check the migration and try again.' }, { status: 409 });
  let notifications = body.id ? null : await sendBusinessSignupNotifications(data, { admin });
  let customerNotification=null;
  const changed=!previous.data || ['status','discount_pct','minimum_units','minimum_order_usd'].some(key=>String(previous.data[key] ?? 0)!==String(data[key] ?? 0));
  // Becoming approved sends the welcome email. Any other change to the terms
  // sends the short "your account was updated" summary.
  const becameApproved = data.status === 'approved' && previous.data?.status !== 'approved';
  const repChanged = previous.data && previous.data.rep_user_id !== data.rep_user_id;
  if (body.id && (becameApproved || repChanged)) notifications = await sendBusinessSignupNotifications(data, { admin });
  if(changed) {
    try {
      const agent = becameApproved ? await resolveBusinessEmailAgent(admin, data) : null;
      const letter = becameApproved ? buildBusinessAccountEmail(data, getPublicSiteUrl(), { agent }) : buildBusinessTermsEmail(data, getPublicSiteUrl());
      customerNotification=await queueBusinessEmail(admin,data,{key:`${becameApproved ? 'welcome' : 'terms'}:${data.id}:${data.updated_at}`,subject:letter.subject,body:letter.text,html:letter.html});
      if (becameApproved) customerNotification = { ...customerNotification, welcome: true };
    } catch(error) { console.error('[business/terms-email]',error.message); customerNotification={sent:false}; }
  }
  return Response.json({ business: data, notifications, customerNotification });
}

export async function DELETE(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id || '') || typeof body.confirmEmail !== 'string' || !body.confirmEmail.trim()) {
    return Response.json({ error: 'Provide the business ID and type its login email to confirm permanent deletion.' }, { status: 400 });
  }
  const admin = scopedAdmin(auth.activeSite);
  // One atomic delete: business-suite foreign keys cascade company-only data;
  // orders keep their snapshots and their business links become NULL.
  const { data, error } = await admin.from('business_accounts').delete().eq('id', body.id).eq('email', body.confirmEmail.trim().toLowerCase()).select('id').maybeSingle();
  if (error) return Response.json({ error: 'Could not permanently delete this business. No changes were made. Please try again.' }, { status: 503 });
  if (!data) return Response.json({ error: 'Business not found or the confirmation email does not match.' }, { status: 404 });
  return Response.json({ ok: true, deletedId: data.id });
}
