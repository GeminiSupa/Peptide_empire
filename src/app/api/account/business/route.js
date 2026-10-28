import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { readBearerToken } from '@/lib/customerOrderOwnership.mjs';
import { businessDetails, findBusinessAccount } from '@/lib/businessAccounts.mjs';
import nodemailer from 'nodemailer';
import { getOrderMailSettings } from '@/lib/transactionalSmtp';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import { buildBusinessAccountEmail } from '@/lib/businessAccountEmail.mjs';
import { getOrderEmailLogoAttachment } from '@/lib/orderEmailBranding.mjs';
import { sendBusinessSignupNotifications } from '@/lib/businessSignupNotifications.mjs';
import { businessProductPrices, publicBusiness, referralBusinessPatch } from '@/lib/businessSuiteServer';

async function context(request) {
  const admin = getSupabaseAdmin();
  let token;
  try { token = readBearerToken(request.headers.get('authorization')); } catch { return null; }
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email_confirmed_at || !data.user.email) return null;
  return { admin, email: data.user.email.toLowerCase().trim() };
}

export async function GET(request) {
  const ctx = await context(request);
  if (!ctx) return Response.json({ error: 'Verified sign-in required.' }, { status: 401 });
  try {
    const business = await findBusinessAccount(ctx.admin, ctx.email);
    return Response.json({ business: publicBusiness(business, await businessProductPrices(ctx.admin,business)) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unable to load your business account. Please try again.' }, { status: 503 });
  }
}

export async function POST(request) {
  const ctx = await context(request);
  if (!ctx) return Response.json({ error: 'Verified sign-in required.' }, { status: 401 });
  let details;
  try { const body=await request.json(); details = { ...businessDetails(body), ...await referralBusinessPatch(ctx.admin,body.referral_code) }; }
  catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  // No upsert: repeat submissions cannot reset approved terms or overwrite a
  // company created by staff. Identity changes need staff review.
  const { data, error } = await ctx.admin.from('business_accounts').insert({ ...details, email: ctx.email }).select('*').single();
  if (error) return Response.json({ error: error.code === '23505' ? 'This email or corporation number is already registered. Contact us for help.' : 'Unable to submit your application. Please try again.' }, { status: error.code === '23505' ? 409 : 503 });
  const staffNotification = sendBusinessSignupNotifications(data);
  let emailSent = false;
  try {
    const { smtp, from } = getOrderMailSettings();
    if (smtp.configured) {
      await nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 }).sendMail({
        from, to: ctx.email,
        ...buildBusinessAccountEmail(data, `${getPublicSiteUrl()}/account/login?next=%2Faccount%2Fbusiness`, { application: true }),
        attachments: [getOrderEmailLogoAttachment()],
      });
      emailSent = true;
    }
  } catch (error) { console.error('[business/application-email]', error.message); }
  const notifications = await staffNotification;
  return Response.json({ business: data, emailSent, staffNotified: notifications.every(result => result.sent) }, { status: 201 });
}
