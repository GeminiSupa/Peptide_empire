import { offlineConversionEvent, googleRequestState } from './googleAdsConversions.mjs';
import { leadClickForOrder, loadLeadClicks } from './leadAdClick.mjs';
export async function runGoogleAdsImport(admin, google) {
  // Read once per run, and only if an order without its own click needs it.
  let leadClicks;
  async function withLeadClick(order, paidAt) {
    if (order.ad_attribution) return order;
    leadClicks ??= await loadLeadClicks(admin);
    const click = leadClickForOrder(order, leadClicks, paidAt);
    if (!click) return order;
    // Record it on the order too, never replacing one it already has.
    try { await admin.from('orders').update({ ad_attribution: click }).eq('id', order.id).is('ad_attribution', null); } catch {}
    return { ...order, ad_attribution: click };
  }
  const deadline = Date.now() + 230000;
  const allowedDestinations = google.destinations || new Set([google.destination]);
  async function concurrent(rows, action) {
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(5, rows.length) }, async () => {
      while (index < rows.length && Date.now() < deadline) { const row = rows[index++]; await action(row); }
    }));
  }
  const summary = { submitted: 0, accepted: 0, failed: 0, skipped: 0 };
  async function update(id, values) { const result = await admin.from('google_ads_conversion_exports').update(values).eq('id', id); if (result.error) throw new Error('Could not persist conversion upload state.'); }
  const submitted = await admin.from('google_ads_conversion_exports').select('id,request_id,destination').eq('status','submitted').order('submitted_at').limit(100);
  if (submitted.error) throw new Error('Run add-google-ads-conversions.sql before enabling imports.');
  await concurrent(submitted.data || [], async row => {
    if (!allowedDestinations.has(row.destination)) return;
    try {
      const result = await google.status(row.request_id); const state = googleRequestState(result);
      if (state === 'submitted') return;
      await update(row.id, { status: state, ...(state === 'accepted' ? { accepted_at: new Date().toISOString(), last_error: null } : { last_error: 'Google rejected this request. Inspect Data Manager diagnostics using its request ID.', next_attempt_at: new Date(Date.now()+3600000).toISOString() }) });
      summary[state]++;
    } catch { summary.failed++; }
  });
  for (let batch = 0; batch < 10 && Date.now() < deadline; batch++) {
  const claimed = await admin.rpc('claim_google_ads_exports', { batch_size: 50 });
  if (claimed.error) throw new Error('Could not claim pending conversion exports.');
  if (!claimed.data?.length) break;
  await concurrent(claimed.data || [], async row => {
    try {
      const current = await admin.from('orders').select('*').eq('id', row.order_id).maybeSingle();
      if (current.error) throw new Error('Could not read confirmed order.');
      const paymentMethod = String(current.data?.payment_method || '').toLowerCase();
      let event;
      try { event = offlineConversionEvent(await withLeadClick(current.data || {}, row.paid_at), row.paid_at); }
      catch (error) { await update(row.id, { status: 'skipped', lease_until: null, last_error: error.message }); summary.skipped++; return; }
      const result = await google.upload(event, false, paymentMethod);
      if (!result.requestId) throw new Error('Google returned no request ID.');
      const destination = google.destinationFor ? google.destinationFor(paymentMethod) : google.destination;
      await update(row.id, { status: 'submitted', request_id: result.requestId, destination, lease_until: null, submitted_at: new Date().toISOString(), last_error: null });
      summary.submitted++;
    } catch (error) {
      await update(row.id, { status: 'failed', lease_until: null, last_error: error.message, next_attempt_at: new Date(Date.now()+Math.min(24,2**Math.min(row.attempts,5))*3600000).toISOString() }); summary.failed++;
    }
  });
  }
  return summary;
}
