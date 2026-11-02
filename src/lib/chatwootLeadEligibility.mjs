/**
 * Who gets a Chatwoot conversation opened BY US, from the CRM.
 *
 * Paid ad pages, TikTok forms and Meta lead forms do: those visitors have no
 * WhatsApp chat of their own, so the chat we open is the only one.
 *
 * Catalog leads used to as well, and it caused duplicates. The catalog form
 * opens a brand-new conversation on every submission, so a customer who was
 * already chatting on WhatsApp ended up with several conversations, each one
 * landing with a different agent. Catalog leads now come in through the
 * conversation layer instead, which matches the number to the contact that
 * already exists and keeps everything in one chat.
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
 * Ad and TikTok leads only. A WhatsApp opt-in on a catalog lead is NOT enough:
 * that number is handled by the conversation layer, and opening a chat here
 * would be the second conversation for the same person.
 */
export function leadBelongsInChatwoot(lead) {
  if (!lead) return false;
  const source = clean(lead.lead_source).toLowerCase();
  if (AD_LANDING_SOURCES.has(source) || source === 'tiktok_form' || source === META_LEAD_SOURCE) return true;
  return isAdLandingLead(lead);
}
