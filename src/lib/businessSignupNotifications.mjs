import nodemailer from 'nodemailer';
import { getOrderMailSettings } from './transactionalSmtp.js';
import { getOwnDomainSmtpConfig, isOwnDomainAddress } from './ownDomainSmtp.mjs';
import { ORDER_NOTIFICATION_INBOX, ORDER_NOTIFICATION_OWNER_BCC } from './orderEmailAddressing.mjs';

export const BUSINESS_SIGNUP_RECIPIENTS = [ORDER_NOTIFICATION_OWNER_BCC, ORDER_NOTIFICATION_INBOX];

export async function sendBusinessSignupNotifications(business, {
  createTransport = config => nodemailer.createTransport(config),
  mailSettings = getOrderMailSettings(),
  ownSmtp = getOwnDomainSmtpConfig(),
} = {}) {
  const text = [
    'New business account — Peptides Costa Rica',
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
  return Promise.all(BUSINESS_SIGNUP_RECIPIENTS.map(async destination => {
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
      });
      if ((result.rejected || []).some(address => String(address).toLowerCase() === destination)) throw new Error('SMTP rejected the notification recipient');
      return { destination, sent: true };
    } catch (error) {
      console.error('[business/signup-notification]', destination, error.message);
      return { destination, sent: false, error: error.message };
    }
  }));
}
