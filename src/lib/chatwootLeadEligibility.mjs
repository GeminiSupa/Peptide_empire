/**
 * Who gets a Chatwoot conversation from the CRM.
 *
 * Paid ad pages and TikTok forms already do. Catalog leads that opted into
 * WhatsApp do too — that is the number they typed for us to reach them on.
 * Pure helpers so the Leads tab and the server share one rule.
 */

import { isAdLandingLead, AD_LANDING_SOURCES } from './adLandingLeads.mjs';

const clean = (value) => String(value ?? '').trim();

/** Phone the Chatwoot contact should carry, or '' when we do not have one. */
export function leadChatwootPhone(lead) {
  const direct = clean(lead?.phone);
  if (direct) return direct;
  const method = clean(lead?.contact_method).toLowerCase();
  const value = clean(lead?.contact_value);
  if (!value || value.includes('@')) return '';
  if (method === 'whatsapp' || method === 'phone' || method === '') {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 ? value : '';
  }
  return '';
}

/**
 * True when this lead should open (or already have) a Chatwoot conversation.
 *
 * WhatsApp opt-in alone is not enough — we need a phone to put on the contact.
 */
export function leadBelongsInChatwoot(lead) {
  if (!lead) return false;
  const source = clean(lead.lead_source).toLowerCase();
  if (AD_LANDING_SOURCES.has(source) || source === 'tiktok_form') return true;
  if (isAdLandingLead(lead)) return true;
  if (lead.whatsapp_consent !== true) return false;
  return Boolean(leadChatwootPhone(lead));
}
