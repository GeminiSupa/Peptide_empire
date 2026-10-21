import { writeDroppingMissingColumns } from './optionalColumns.mjs';
import { hasLandingQualification, landingQualificationNotes } from './landingLead.mjs';
import { leadBelongsInChatwoot, leadChatwootPhone } from './chatwootLeadEligibility.mjs';
import {
  CHATWOOT_INBOX_SETTING_ID,
  inboxIdForLeadSource,
  isPaidAdChatwootSource,
  loadCatalogInboxId,
} from './chatwootInboxes.mjs';

const TIMEOUT_MS = 8000;
// One name per row: the id itself lives in chatwootInboxes.mjs, which both the
// switch and the catalog inbox read. Re-exported here because callers already
// import it from this module.
export { CHATWOOT_INBOX_SETTING_ID as CHATWOOT_LEAD_SETTING_ID };

export { leadBelongsInChatwoot, leadChatwootPhone };

const clean = (value) => String(value ?? '').trim();

const CHATWOOT_LEAD_COLUMNS = [
  'chatwoot_status',
  'chatwoot_error',
  'chatwoot_conversation_id',
  'chatwoot_contact_id',
  'chatwoot_conversation_status',
  'chatwoot_assignee_email',
  'chatwoot_conversation_url',
  'chatwoot_synced_at',
];

export async function loadChatwootLeadEnabled(supabase) {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', CHATWOOT_INBOX_SETTING_ID)
      .maybeSingle();
    if (error) throw error;
    return data?.value?.enabled !== false;
  } catch (error) {
    // Keep the integration on when an older deployment has not created the
    // setting row yet. The admin switch writes that row on its first change.
    console.warn('[Chatwoot] Could not read the admin switch; using enabled:', error.message);
    return true;
  }
}

// `inboxIdOverride` is the inbox THIS lead belongs in. An empty string is
// meaningful: it says we have no inbox for this lead, so the config reads as
// unconfigured instead of quietly falling back to the ad inbox.
function readConfig(env, inboxIdOverride) {
  const baseUrl = clean(env.CHATWOOT_BASE_URL).replace(/\/+$/, '');
  const accountId = clean(env.CHATWOOT_ACCOUNT_ID);
  const inboxId = clean(inboxIdOverride === undefined ? env.CHATWOOT_INBOX_ID : inboxIdOverride);
  const accessToken = clean(env.CHATWOOT_API_ACCESS_TOKEN);
  return {
    baseUrl,
    accountId,
    inboxId,
    accessToken,
    configured: Boolean(baseUrl && accountId && inboxId && accessToken),
  };
}

async function chatwootRequest(url, { accessToken = '', fetchImpl, method = 'GET', body } = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { api_access_token: accessToken } : {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = clean(payload?.message || payload?.error || payload?.errors?.[0])
      || `Chatwoot returned ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function contactSourceId(contact, inboxId) {
  if (clean(contact?.source_id)) return clean(contact.source_id);
  const inbox = (contact?.contact_inboxes || []).find((entry) => (
    String(entry?.inbox?.id ?? entry?.inbox_id ?? '') === String(inboxId)
  ));
  return clean(inbox?.source_id);
}

// Chatwoot only accepts +<country code><number>, up to 15 digits, no leading 0.
// A number typed in local format ("0300 1234567") fails that, and Chatwoot then
// refuses the whole contact — so such a number is left off the contact and the
// agent still reads it in the chat message.
export function chatwootPhone(phone) {
  const digits = clean(phone).replace(/\D/g, '');
  return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : '';
}

async function findExistingContact({ config, identifier, fetchImpl }) {
  const url = `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts/search?q=${encodeURIComponent(identifier)}`;
  const result = await chatwootRequest(url, { accessToken: config.accessToken, fetchImpl });
  const contacts = Array.isArray(result?.payload) ? result.payload : [];
  return contacts.find((contact) => clean(contact?.identifier) === identifier) || null;
}

export function buildChatwootLeadMessage({
  leadId,
  name,
  email,
  phone,
  source,
  qualificationLines = [],
  campaign,
  dueAt,
}) {
  // No owner line: the chat itself is assigned to the agent, and a name typed
  // into the message goes stale the moment someone reassigns it.
  const key = clean(source).toLowerCase();
  let title = 'New lead';
  if (key === 'tiktok_form') title = 'New TikTok form lead';
  else if (key === 'glp1_lp') title = 'New Google Ads lead — /glp-1';
  else if (key === 'adwords_lp') title = 'New Google Ads lead — /lp';
  else if (key === 'catalog_gate' || key === 'catalog_reprompt' || key === 'catalog_whatsapp') {
    title = 'New WhatsApp catalog lead';
  }
  return [
    title,
    `Name: ${clean(name) || 'Not provided'}`,
    `Email: ${clean(email) || 'Not provided'}`,
    `Phone: ${clean(phone) || 'Not provided'}`,
    ...qualificationLines.map(clean).filter(Boolean),
    campaign ? `Campaign: ${clean(campaign)}` : null,
    dueAt ? `Response due: ${new Date(dueAt).toLocaleString('en-US', { timeZone: 'America/Costa_Rica' })} Costa Rica time` : null,
    `CRM lead ID: ${clean(leadId)}`,
  ].filter(Boolean).join('\n');
}

/**
 * Assigns the chat to the Chatwoot agent whose login email matches the CRM
 * owner. The message is already delivered by now, so a failure here only
 * leaves the chat unassigned — it is reported, never thrown.
 */
async function assignConversation({ config, conversationId, assigneeEmail, fetchImpl }) {
  const wanted = clean(assigneeEmail).toLowerCase();
  if (!wanted) return { assigneeId: null };
  try {
    const agents = await chatwootRequest(
      `${config.baseUrl}/api/v1/accounts/${config.accountId}/agents`,
      { accessToken: config.accessToken, fetchImpl },
    );
    const agent = (Array.isArray(agents) ? agents : [])
      .find((entry) => clean(entry?.email).toLowerCase() === wanted);
    if (!agent?.id) return { assigneeId: null, error: `No Chatwoot agent uses ${wanted}` };
    await chatwootRequest(
      `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/assignments`,
      { accessToken: config.accessToken, fetchImpl, method: 'POST', body: { assignee_id: agent.id } },
    );
    return { assigneeId: agent.id };
  } catch (error) {
    return { assigneeId: null, error: clean(error?.message) || 'Chatwoot assignment failed' };
  }
}

/**
 * The catalog_leads columns that record one delivery attempt, so the Leads tab
 * can show it. `enabled` false means the admin switch was off.
 */
export function chatwootLeadColumns(result, { enabled = true, at = new Date().toISOString() } = {}) {
  let status;
  if (!enabled) status = 'off';
  else if (!result?.configured) status = 'not_configured';
  else if (!result.sent) status = 'failed';
  else if (result.assignmentError) status = 'unassigned';
  else status = 'sent';
  return {
    chatwoot_status: status,
    chatwoot_error: clean(result?.error || result?.assignmentError).slice(0, 500) || null,
    chatwoot_conversation_id: result?.conversationId || null,
    chatwoot_contact_id: result?.contactId || null,
    chatwoot_conversation_status: result?.sent ? 'open' : null,
    chatwoot_assignee_email: clean(result?.assigneeEmail) || null,
    chatwoot_conversation_url: result?.conversationUrl || null,
    chatwoot_synced_at: at,
  };
}

/**
 * Opens a Chatwoot conversation for one CRM lead (ad form or WhatsApp opt-in).
 * The API token stays server-side; a Chatwoot outage never changes whether the
 * CRM lead itself was accepted.
 */
export async function sendAdLeadToChatwoot({
  leadId,
  name,
  email,
  phone,
  source,
  qualificationLines,
  campaign,
  assigneeEmail,
  dueAt,
  inboxId,
  env = process.env,
  fetchImpl = fetch,
}) {
  const config = readConfig(env, inboxId);
  if (!config.configured) {
    // Say WHICH piece is missing. A blank catalog inbox is the one an admin can
    // fix themselves, and "not_configured" with no reason reads as a Chatwoot
    // outage instead of a field someone still has to fill in.
    const onlyInboxMissing = !config.inboxId
      && Boolean(config.baseUrl && config.accountId && config.accessToken);
    return {
      configured: false,
      sent: false,
      ...(onlyInboxMissing
        ? { error: 'No Chatwoot inbox is set for this kind of lead. Add the catalog WhatsApp inbox ID under Team → Notification settings.' }
        : {}),
    };
  }
  if (!leadId) return { configured: true, sent: false, error: 'A CRM lead ID is required' };

  try {
    const inbox = await chatwootRequest(
      `${config.baseUrl}/api/v1/accounts/${config.accountId}/inboxes/${config.inboxId}`,
      { accessToken: config.accessToken, fetchImpl },
    );
    const inboxIdentifier = clean(inbox?.inbox_identifier);
    if (!inboxIdentifier) throw new Error('The Chatwoot inbox has no API identifier');

    // Keep the old prefix for ad/TikTok contacts already in Chatwoot so a retry
    // finds the same person instead of opening a second contact.
    const identifier = isPaidAdChatwootSource(source)
      ? `google-ads-lead-${leadId}`
      : `crm-lead-${leadId}`;
    const contactsUrl = `${config.baseUrl}/public/api/v1/inboxes/${inboxIdentifier}/contacts`;
    const contactName = clean(name)
      || (isPaidAdChatwootSource(source) ? `Google Ads lead ${leadId}` : `Catalog lead ${leadId}`);
    const phoneNumber = chatwootPhone(phone);
    const createContact = (body) => chatwootRequest(contactsUrl, { fetchImpl, method: 'POST', body });
    let contact;
    try {
      contact = await createContact({
        identifier,
        name: contactName,
        ...(clean(email) ? { email: clean(email) } : {}),
        ...(phoneNumber ? { phone_number: phoneNumber } : {}),
      });
    } catch (error) {
      if (error.status !== 422) throw error;
      contact = await findExistingContact({ config, identifier, fetchImpl });
      // 422 without a contact of ours means Chatwoot disliked the email or
      // phone (bad format, or already on another contact). Both are in the
      // message anyway, so open the chat without them rather than lose it.
      if (!contact) contact = await createContact({ identifier, name: contactName });
    }

    const sourceId = contactSourceId(contact, config.inboxId);
    if (!sourceId) throw new Error('Chatwoot did not return a contact source ID');

    const conversation = await chatwootRequest(
      `${contactsUrl}/${encodeURIComponent(sourceId)}/conversations`,
      { fetchImpl, method: 'POST', body: { source_id: sourceId } },
    );
    if (!conversation?.id) throw new Error('Chatwoot did not return a conversation ID');

    const content = buildChatwootLeadMessage({
      leadId, name, email, phone, source, qualificationLines, campaign, dueAt,
    });
    const message = await chatwootRequest(
      `${contactsUrl}/${encodeURIComponent(sourceId)}/conversations/${conversation.id}/messages`,
      { fetchImpl, method: 'POST', body: { content, message_type: 'incoming', private: false } },
    );

    const assignment = await assignConversation({
      config, conversationId: conversation.id, assigneeEmail, fetchImpl,
    });

    return {
      configured: true,
      sent: true,
      contactId: contact?.id || null,
      conversationId: conversation.id,
      conversationUrl: `${config.baseUrl}/app/accounts/${config.accountId}/conversations/${conversation.id}`,
      messageId: message?.id || null,
      assigneeId: assignment.assigneeId,
      assigneeEmail: assignment.assigneeId ? clean(assigneeEmail).toLowerCase() : null,
      ...(assignment.error ? { assignmentError: assignment.error } : {}),
    };
  } catch (error) {
    return { configured: true, sent: false, error: clean(error?.message) || 'Chatwoot delivery failed' };
  }
}

/**
 * Chatwoot login email for the CRM owner name on the lead, or '' when unknown.
 */
export async function chatwootAssigneeEmailForLead(supabase, lead) {
  const wanted = clean(lead?.sales_agent).toLowerCase();
  if (!wanted) return '';
  try {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('name, email');
    if (error) throw error;
    const match = (data || []).find((row) => {
      const name = clean(row?.name).toLowerCase();
      const email = clean(row?.email).toLowerCase();
      return name === wanted || email === wanted;
    });
    return clean(match?.email);
  } catch (error) {
    console.warn('[Chatwoot] Could not resolve assignee email:', error.message);
    return '';
  }
}

/**
 * One CRM lead → Chatwoot: eligibility, admin switch, send, write status columns.
 * Used on capture/opt-in and by the 15-minute retry cron.
 */
export async function handoverLeadToChatwoot(supabase, lead, {
  assigneeEmail,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  if (!lead?.id || !leadBelongsInChatwoot(lead)) {
    return { skipped: true, sent: false };
  }

  const enabled = await loadChatwootLeadEnabled(supabase);
  const source = clean(lead.lead_source)
    || clean(lead.consent_source)
    || (lead.whatsapp_consent === true ? 'catalog_whatsapp' : '');
  const phone = leadChatwootPhone(lead);
  // Ad chats stay unassigned so Chatwoot can pick; WhatsApp catalog leads go to
  // the CRM owner when we know who that is.
  let email = assigneeEmail;
  if (email === undefined) {
    email = isPaidAdChatwootSource(source) ? '' : await chatwootAssigneeEmailForLead(supabase, lead);
  }

  // Which inbox this chat opens in. Ad and TikTok leads keep the original
  // WhatsApp number; catalog leads use the catalog number, so the two streams
  // can be told apart. No catalog inbox saved yet means no inbox for this lead:
  // the config reads as unconfigured, the lead keeps a null
  // chatwoot_conversation_id, and the 15-minute retry delivers it as soon as
  // the inbox is filled in. It never falls back to the ad inbox.
  const catalogInboxId = isPaidAdChatwootSource(source)
    ? ''
    : await loadCatalogInboxId(supabase);
  const inboxId = inboxIdForLeadSource(source, {
    adInboxId: env.CHATWOOT_INBOX_ID,
    catalogInboxId,
  });

  const qualification = lead.qualification_data || {};
  const result = enabled
    ? await sendAdLeadToChatwoot({
      leadId: lead.id,
      name: clean(lead.name) || clean(lead.contact_value) || phone,
      email: lead.email,
      phone,
      source,
      qualificationLines: hasLandingQualification(qualification)
        ? landingQualificationNotes(qualification)
        : [],
      campaign: [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / '),
      assigneeEmail: email || '',
      dueAt: lead.response_due_at,
      inboxId,
      env,
      fetchImpl,
    })
    : { configured: true, sent: false };

  await writeDroppingMissingColumns(
    chatwootLeadColumns(result, { enabled }),
    CHATWOOT_LEAD_COLUMNS,
    (row) => (Object.keys(row).length
      ? supabase.from('catalog_leads').update(row).eq('id', lead.id)
      : Promise.resolve({ error: null })),
  );

  return { ...result, enabled, skipped: false };
}
