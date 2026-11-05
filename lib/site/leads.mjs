import { catalogUrl } from '../storefront/catalog-origin.mjs';
import { leadAttribution } from './attribution.mjs';

/**
 * Saving a form as a lead in the CRM.
 *
 * Posts to the catalog's `/api/leads/contact` — the route the catalog's own
 * "Contáctenos" dialog uses. It writes the lead to the CRM Leads tab, gives
 * it to the agent who already owns that customer (or leaves it claimable),
 * and alerts the team. The route takes posts from other sites by design.
 *
 * Only the fields that route reads are sent. Answers it has no column for
 * (topic, message, the application questions) stay in the WhatsApp message
 * the forms still open. Qualification answers are deliberately not sent:
 * the route treats any as a paid Google Ads lead (consent required, ad
 * rotation, response deadline), which these are not.
 */

/** The hidden field and timer the route's bot filter reads (catalog leadSpam.mjs). */
export const LEAD_HONEYPOT_FIELD = 'subject';

/** Where each form's leads say they came from, as shown in the Leads tab. */
export const LEAD_SOURCES = {
  contact: 'website_contact',
  affiliate: 'website_affiliate',
  pro_account: 'website_pro_account',
};

/** The request body, exactly as the catalog's contact dialog builds it. */
export function leadPayload({ name, email, phone, source, lang, honeypot = '', formMs }, attribution = {}) {
  return {
    name: String(name || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    language: lang === 'en' ? 'en' : 'es',
    source,
    ...attribution,
    [LEAD_HONEYPOT_FIELD]: honeypot,
    form_ms: formMs,
  };
}

/**
 * Save the lead. Resolves `{ ok }` and never throws: the forms still open
 * WhatsApp either way, so a CRM hiccup never loses the enquiry.
 */
export async function saveLead(fields, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(catalogUrl('/api/leads/contact'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayload(fields, leadAttribution())),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[leads] CRM did not save the lead:', response.status, data?.error || '');
    }
    return { ok: response.ok, error: data?.error || null };
  } catch (error) {
    console.warn('[leads] CRM did not save the lead:', error?.message || error);
    return { ok: false, error: 'network' };
  }
}
