const ALLOWED_EVENTS = new Set([
  'dashboard_viewed','tools_viewed','tool_tab_viewed','checkout_started',
  'list_created','list_deleted','quote_requested','member_invited',
  'member_removed','invoice_downloaded','language_changed',
]);

function cleanMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => {
    if (Array.isArray(item)) return [String(key).slice(0, 60), item.slice(0, 50).map(entry => String(entry).slice(0, 200))];
    return [String(key).slice(0, 60), ['string','number','boolean'].includes(typeof item) ? (typeof item === 'string' ? item.slice(0, 500) : item) : null];
  }));
}

/** Analytics must never prevent a customer action from succeeding. */
export async function recordBusinessActivity(admin, business, email, eventType, metadata = {}) {
  if (!business?.id || !email || !ALLOWED_EVENTS.has(eventType)) return false;
  try {
    if (eventType === 'dashboard_viewed' || eventType === 'tools_viewed') {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const recent = await admin.from('business_activity_events').select('id').eq('business_id', business.id).eq('member_email', String(email).toLowerCase().trim()).eq('event_type', eventType).gte('occurred_at', since).limit(1);
      if (!recent.error && recent.data?.length) return true;
      if (recent.error && ['42P01','PGRST205'].includes(recent.error.code)) return false;
    }
    const { error } = await admin.from('business_activity_events').insert({
      business_id: business.id,
      member_email: String(email).toLowerCase().trim(),
      event_type: eventType,
      metadata: cleanMetadata(metadata),
    });
    if (error && !['42P01','PGRST205'].includes(error.code)) console.error('[business/activity]', error.message);
    return !error;
  } catch (error) {
    console.error('[business/activity]', error.message);
    return false;
  }
}
