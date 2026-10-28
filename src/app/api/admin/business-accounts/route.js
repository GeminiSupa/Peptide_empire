import nodemailer from 'nodemailer';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { businessDetails } from '@/lib/businessAccounts.mjs';
import { getOrderMailSettings } from '@/lib/transactionalSmtp';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import { rateLimit } from '@/lib/rateLimit.mjs';
import { buildBusinessAccountEmail } from '@/lib/businessAccountEmail.mjs';
import { getOrderEmailLogoAttachment } from '@/lib/orderEmailBranding.mjs';
import { sendBusinessSignupNotifications } from '@/lib/businessSignupNotifications.mjs';
import { validateBusinessTerms } from '@/lib/businessSuite.mjs';
import { validatedBusinessRep, queueBusinessEmail } from '@/lib/businessSuiteServer';

export async function GET(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const { data, error } = await getSupabaseAdmin().from('business_accounts').select('*').order('created_at', { ascending: false }).limit(500);
  return error ? Response.json({ error: 'Could not load business accounts.' }, { status: 503 }) : Response.json({ businesses: data }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const admin = getSupabaseAdmin();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (body.action === 'invite' || body.action === 'notify') {
    const { data: business, error } = await admin.from('business_accounts').select('*').eq('id', body.id).single();
    if (error || !business) return Response.json({ error: 'Business not found.' }, { status: 404 });
    if (body.action === 'notify') {
      if (!rateLimit(`business-notify:${business.id}`, 2)) return Response.json({ error: 'Please wait before resending staff alerts.' }, { status: 429 });
      const notifications = await sendBusinessSignupNotifications(business);
      return Response.json({ ok: notifications.every(result => result.sent), notifications });
    }
    if (business.status !== 'approved') return Response.json({ error: 'Approve the account before inviting.' }, { status: 409 });
    if (!rateLimit(`business-invite:${business.id}`, 2)) return Response.json({ error: 'Please wait before sending another invitation.' }, { status: 429 });
    const { smtp, from } = getOrderMailSettings();
    if (!smtp.host || !smtp.user || !smtp.pass) return Response.json({ error: 'Account saved. Email delivery is not configured.' }, { status: 503 });
    const login = `${getPublicSiteUrl()}/account/login?next=%2Faccount%2Fbusiness`;
    try {
      await nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass } }).sendMail({
        from, to: business.email,
        ...buildBusinessAccountEmail(business, login),
        attachments: [getOrderEmailLogoAttachment()],
      });
      return Response.json({ ok: true });
    } catch { return Response.json({ error: 'Account saved, but the invitation could not be sent. Please retry.' }, { status: 502 }); }
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
  const row = { ...details, email, status: body.status, discount_pct: pct };
  const previous=body.id ? await admin.from('business_accounts').select('*').eq('id',body.id).eq('email',email).maybeSingle() : {data:null};
  if(previous.error) return Response.json({error:'Unable to read current business terms.'},{status:503});
  // Updates cannot retarget a business to another mailbox accidentally.
  const query = body.id
    ? admin.from('business_accounts').update(row).eq('id', body.id).eq('email', email)
    : admin.from('business_accounts').insert(row);
  const { data, error } = await query.select('*').single();
  if (error) return Response.json({ error: error.code === '23505' ? 'This email or corporation number is already registered.' : 'Could not save business account. Check the migration and try again.' }, { status: 409 });
  const notifications = body.id ? null : await sendBusinessSignupNotifications(data);
  let customerNotification=null;
  const changed=!previous.data || ['status','discount_pct','minimum_units','minimum_order_usd'].some(key=>String(previous.data[key] ?? 0)!==String(data[key] ?? 0));
  if(changed) {
    try {
      customerNotification=await queueBusinessEmail(admin,data,{key:`terms:${data.id}:${data.updated_at}`,subject:'Cuenta empresarial actualizada / Business account updated',body:`${data.legal_name}\nEstado / Status: ${data.status}\nDescuento / Discount: ${data.discount_pct}%\nMínimo de unidades / Minimum merchandise units: ${data.minimum_units || 0}\nCompra mínima / Minimum products total after discounts: US$${Number(data.minimum_order_usd || 0).toFixed(2)}\nInicie sesión para consultar las condiciones actuales. / Sign in to review your current terms.`});
    } catch(error) { console.error('[business/terms-email]',error.message); customerNotification={sent:false}; }
  }
  return Response.json({ business: data, notifications, customerNotification });
}
