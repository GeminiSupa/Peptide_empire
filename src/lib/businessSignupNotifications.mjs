import nodemailer from 'nodemailer';
import { getOrderMailSettings } from './transactionalSmtp.js';
import { getOwnDomainSmtpConfig, isOwnDomainAddress } from './ownDomainSmtp.mjs';
import { ORDER_NOTIFICATION_INBOX, ORDER_NOTIFICATION_OWNER_BCC } from './orderEmailAddressing.mjs';
import { emailShell } from './accountSignInCode.mjs';
import { getOrderEmailLogoAttachment } from './orderEmailBranding.mjs';
import { resolveBusinessEmailAgent } from './businessEmailAgent.mjs';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function buildBusinessStaffAlertHtml(business) {
  const base = 'https://catalog.peptidescostarica.net/admin';
  const link = action => `${base}?${new URLSearchParams({ tab: 'customers', business: business.id || '', businessAction: action })}`;
  const rows = [
    ['Company', business.legal_name], ['Trading name', business.trading_name || '—'],
    ['Cédula jurídica', business.corporation_number], ['Contact', business.contact_name],
    ['Customer login / welcome email recipient', business.email], ['Phone', business.phone],
    ['Billing address', business.billing_address], ['Delivery address', business.delivery_address || 'Same as billing'],
    ['Status', business.status], ['Agreed discount', `${business.discount_pct}%`],
    ['Minimum merchandise units', business.minimum_units || 0], ['Minimum purchase (USD)', Number(business.minimum_order_usd || 0).toFixed(2)],
  ];
  const action = (label, value, color) => `<a href="${escape(link(value))}" style="display:inline-block;background:${color};color:#ffffff;padding:13px 18px;margin:6px 6px 6px 0;border-radius:8px;font-weight:700;text-decoration:none;">${label}</a>`;
  return emailShell({ lang: 'en', width: 640, title: 'Business account details', subtitle: escape(business.legal_name),
    body: `<p style="font-size:15px;line-height:1.6;color:#334155;">Staff notification. Review the current company details below. Customer welcome emails are sent separately to <strong>${escape(business.email)}</strong> after approval.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;">${rows.map(([label, value]) => `<tr><td style="padding:11px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;vertical-align:top;">${escape(label)}</td><td style="padding:11px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;">${escape(value).replace(/\r?\n/g, '<br>')}</td></tr>`).join('')}</table>
      <p style="font-size:14px;line-height:1.6;color:#334155;">${business.status === 'pending' ? 'Pending accounts receive no business pricing. Review the terms, then choose Approve &amp; send welcome email in the admin.' : 'Manage the saved business terms in the admin. Approved accounts can receive the welcome email again using Resend welcome email.'}</p>
      <p>${action('Review business', 'review', '#0284c7')}${action('Edit details', 'edit', '#0f172a')}${action('Delete business', 'delete', '#b91c1c')}</p>
      <p style="font-size:12px;line-height:1.5;color:#64748b;">These links require an owner admin login. Delete opens the business for review; permanent deletion requires typing the company email in the admin. Opening an email link never deletes a record.</p>` });
}

export const BUSINESS_SIGNUP_RECIPIENTS = [ORDER_NOTIFICATION_OWNER_BCC, ORDER_NOTIFICATION_INBOX];

export async function sendBusinessSignupNotifications(business, {
  createTransport = config => nodemailer.createTransport(config),
  mailSettings = getOrderMailSettings(),
  ownSmtp = getOwnDomainSmtpConfig(),
  admin,
} = {}) {
  let agent = null, agentError = null;
  try { agent = business.rep_user_id ? await resolveBusinessEmailAgent(admin || getSupabaseAdmin(), business) : null; }
  catch (error) { agentError = { destination: 'assigned agent', sent: false, error: error.message }; }
  const text = [
    'New business account — Peptidos Colombia',
    `Company: ${business.legal_name}`,
    `Trading name: ${business.trading_name || '—'}`,
    `Cédula jurídica: ${business.corporation_number}`,
    `Contact: ${business.contact_name}`,
    `Email: ${business.email}`,
    `Phone: ${business.phone}`,
    `Billing address: ${business.billing_address}`,
    `Delivery address: ${business.delivery_address || '—'}`,
    `Status: ${business.status}`,
    `Discount: ${business.discount_pct}%`,
    '',
    'Review the account in Customers → Customer accounts → Business accounts.',
    'Pending accounts receive no business discount until approved.',
  ].join('\n');
  const recipients = [...new Set([...BUSINESS_SIGNUP_RECIPIENTS, ...(agent?.email ? [agent.email] : [])].map(email => email.toLowerCase()))];
  const results = await Promise.all(recipients.map(async destination => {
    try {
      // Our Rackspace inbox must receive its copy through our own mail host.
      const own = isOwnDomainAddress(destination);
      const smtp = own ? ownSmtp : mailSettings.smtp;
      if (!smtp.configured) throw new Error(own ? 'Own-domain SMTP is not configured' : 'Transactional SMTP is not configured');
      const result = await createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      }).sendMail({
        from: own ? ownSmtp.from : mailSettings.from,
        to: destination, replyTo: business.email,
        subject: `New business account: ${String(business.legal_name).replace(/[\r\n]/g, ' ')}`,
        text,
        html: buildBusinessStaffAlertHtml(business),
        attachments: [getOrderEmailLogoAttachment()],
      });
      if ((result.rejected || []).some(address => String(address).toLowerCase() === destination)) throw new Error('SMTP rejected the notification recipient');
      return { destination, sent: true };
    } catch (error) {
      console.error('[business/signup-notification]', destination, error.message);
      return { destination, sent: false, error: error.message };
    }
  }));
  return agentError ? [...results, agentError] : results;
}
