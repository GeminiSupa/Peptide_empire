/**
 * The Google ad click behind a hand-made order.
 *
 * Ad visitors fill in the /lp or /glp-1 form, and staff create their order in
 * the CRM later. That order never sees the visitor's browser, so it has no
 * click ID of its own. /api/leads/contact saves the click on the lead; this
 * finds it again for the order, matching the customer the same way the CRM's
 * lead conversion does (email, or the last 8 digits of a phone number).
 */
import { CLICK_TTL, sanitizeAdAttribution } from './adClickAttribution.mjs';
import { normalizeEmail, normalizePhone } from './leadConversion.mjs';

const emails = values => [...new Set(values.map(normalizeEmail).filter(Boolean))];
const phoneTails = values => [...new Set(values.map(normalizePhone).filter(p => p.length >= 8).map(p => p.slice(-8)))];

/**
 * The newest click saved on a lead with this order's email or phone that
 * happened before the payment and within Google's 90-day window. null if none.
 */
export function leadClickForOrder(order, leads, paidAt) {
  const paidMs = Date.parse(paidAt);
  if (!Number.isFinite(paidMs)) return null;
  const orderEmails = emails([order?.customer_email]);
  const orderTails = phoneTails([order?.customer_phone]);
  if (!orderEmails.length && !orderTails.length) return null;
  let best = null;
  for (const lead of leads || []) {
    const click = sanitizeAdAttribution(lead?.ad_attribution, paidMs);
    // Google refuses a conversion dated before its click.
    if (!click || click.clicked_at > paidMs) continue;
    const sameCustomer = emails([lead.email, lead.contact_value]).some(e => orderEmails.includes(e))
      || phoneTails([lead.phone, lead.contact_value]).some(t => orderTails.includes(t));
    if (sameCustomer && (!best || click.clicked_at > best.clicked_at)) best = click;
  }
  return best;
}

/**
 * Leads carrying a click recent enough to still count. A missing column (the
 * migration not run yet) or any read error gives [], so the upload carries on
 * with email/phone matching exactly as before.
 */
export async function loadLeadClicks(admin, now = Date.now()) {
  try {
    // Uploads retry for days, so look a little further back than 90 days.
    const since = now - CLICK_TTL - 30 * 86400000;
    const result = await admin.from('catalog_leads')
      .select('email,phone,contact_value,ad_attribution')
      .gte('ad_attribution->>clicked_at', String(since))
      .limit(5000);
    return result?.error ? [] : result?.data || [];
  } catch {
    return [];
  }
}
