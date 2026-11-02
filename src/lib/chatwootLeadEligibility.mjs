/**
 * Who gets a Chatwoot conversation opened BY US, from the CRM.
 *
 * Paid ad pages, TikTok forms and Meta lead forms do. Catalog leads do when
 * they explicitly opt into WhatsApp and provide a usable phone number. The
 * capture routes already avoid calling this handoff when a conversation id is
 * stored, so restoring eligibility does not reopen a known CRM conversation.
 *
 * Pure helpers so the Leads tab and the server share one rule.
 */

import { isAdLandingLead, AD_LANDING_SOURCES } from './adLandingLeads.mjs';
import { META_LEAD_SOURCE } from './chatwootInboxes.mjs';

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
 * True when this lead should open (or already have) a Chatwoot conversation
 * that the CRM created.
 *
 * A catalog email alone is not enough: it must be a WhatsApp opt-in with a
 * phone number that Chatwoot can use.
 */
export function leadBelongsInChatwoot(lead) {
  if (!lead) return false;
  const source = clean(lead.lead_source).toLowerCase();
  if (AD_LANDING_SOURCES.has(source) || source === 'tiktok_form' || source === META_LEAD_SOURCE) return true;
  if (isAdLandingLead(lead)) return true;
  if (lead.whatsapp_consent !== true) return false;
  return Boolean(leadChatwootPhone(lead));
}
