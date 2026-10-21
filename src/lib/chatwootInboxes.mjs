/**
 * Which Chatwoot inbox a lead's chat belongs in.
 *
 * Until now every lead opened its chat in one inbox — the Google Ads WhatsApp
 * number — so catalog leads arrived looking like paid-ad traffic and could not
 * be told apart for marketing. Catalog leads now get their own inbox (their own
 * WhatsApp number) and paid-ad and TikTok leads keep the original one.
 *
 * The split is deliberately the SAME line chatwootLead.mjs already draws with
 * isPaidAdChatwootSource: ad/TikTok on one side, everything else on the other.
 * A third category here would drift from the identifier prefix, the contact
 * name and the assignee rule, which all key off that one distinction.
 *
 * There is no fall back to the ad inbox. A catalog lead with no catalog inbox
 * configured is left undelivered on purpose — the 15-minute chatwoot-owner-sync
 * retry picks up anything with no conversation id, so these arrive as soon as
 * the inbox is filled in, instead of landing in the wrong inbox for good.
 */

import { AD_LANDING_SOURCES } from './adLandingLeads.mjs';

const clean = (value) => String(value ?? '').trim();

/** The site_settings row that already holds the Chatwoot lead switch. */
export const CHATWOOT_INBOX_SETTING_ID = 'google_ads_chatwoot';

/** True for the paid-ad and TikTok sources that use the original inbox. */
export function isPaidAdChatwootSource(source) {
  const key = clean(source).toLowerCase();
  return AD_LANDING_SOURCES.has(key) || key === 'tiktok_form';
}

/** The catalog inbox id saved in the admin portal, or '' when unset. */
export async function loadCatalogInboxId(supabase) {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', CHATWOOT_INBOX_SETTING_ID)
      .maybeSingle();
    if (error) throw error;
    return clean(data?.value?.catalogInboxId);
  } catch (error) {
    console.warn('[Chatwoot] Could not read the catalog inbox id:', error.message);
    return '';
  }
}

/**
 * The inbox one lead's chat opens in, or '' when we have no inbox for it.
 *
 * '' for a catalog lead means "not configured yet", never "use the ad inbox".
 */
export function inboxIdForLeadSource(source, { adInboxId = '', catalogInboxId = '' } = {}) {
  return isPaidAdChatwootSource(source) ? clean(adInboxId) : clean(catalogInboxId);
}

/**
 * Every inbox our leads live in, for the screens and jobs that read Chatwoot
 * back: the webhook filter, the owner sync and the Leads "Assigned to" column.
 * Each of those used to accept or query the single configured inbox, which
 * would silently ignore every catalog chat once they moved.
 */
export function chatwootLeadInboxIds({ adInboxId = '', catalogInboxId = '' } = {}) {
  return [...new Set([clean(adInboxId), clean(catalogInboxId)].filter(Boolean))];
}

/**
 * Merge one field into the Chatwoot lead setting row.
 *
 * Both the on/off switch and the catalog inbox id live in this single `value`
 * object, and a plain upsert replaces the whole object — saving the switch
 * would wipe the inbox id, and saving the inbox id would turn the integration
 * back on. Read, merge, write.
 */
export async function saveChatwootLeadSetting(supabase, patch) {
  const { data, error: readError } = await supabase
    .from('site_settings')
    .select('value')
    .eq('id', CHATWOOT_INBOX_SETTING_ID)
    .maybeSingle();
  if (readError) return { error: readError };
  const value = { ...(data?.value && typeof data.value === 'object' ? data.value : {}), ...patch };
  const { error } = await supabase.from('site_settings').upsert({
    id: CHATWOOT_INBOX_SETTING_ID,
    value,
  });
  return { error, value };
}

/**
 * A Chatwoot inbox id as typed in the admin, or '' to clear it. Chatwoot inbox
 * ids are plain numbers; anything else is a paste mistake (a whole URL, the
 * phone number) and must be refused rather than saved and silently ignored.
 */
export function normalizeInboxId(input) {
  const value = clean(input);
  if (!value) return { ok: true, inboxId: '' };
  if (!/^\d{1,12}$/.test(value)) {
    return { ok: false, error: 'A Chatwoot inbox ID is a number, e.g. 7. Copy it from the inbox URL in Chatwoot.' };
  }
  return { ok: true, inboxId: value };
}
