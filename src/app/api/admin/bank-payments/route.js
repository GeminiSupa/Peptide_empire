import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BANK_SETTINGS_ID, normalizeBankSettings, bankAvailability, readBankSettings } from '@/lib/bankPayments.mjs';

export async function GET(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  try {
    const settings = await readBankSettings(getSupabaseAdmin());
    const { data: pending, error } = await getSupabaseAdmin().from('orders')
      .select('id,order_number,customer_name,total_crc,status,activity_log')
      .in('payment_method', ['sinpe', 'bank_transfer'])
      .in('status', ['Pending', 'Payment Pending'])
      .contains('activity_log', [{ type: 'bank_payment_reported' }])
      .order('created_at', { ascending: true }).limit(200);
    if (error) throw new Error('Could not load bank payment verification queue');
    return Response.json({ settings, availability: bankAvailability(settings), pending: pending || [] });
  } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
}

export async function PUT(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  try {
    const settings = normalizeBankSettings(await request.json());
    const availability = bankAvailability(settings);
    if ((settings.sinpeEnabled && !availability.sinpe) || (settings.transferEnabled && !availability.bank_transfer)) {
      return Response.json({ error: 'Enter the recipient, legal ID and a valid SINPE number / CRC IBAN before enabling that method.' }, { status: 422 });
    }
    const { error } = await getSupabaseAdmin().from('site_settings').upsert({ id: BANK_SETTINGS_ID, value: settings }, { onConflict: 'id' });
    if (error) throw new Error('Could not save BAC settings');
    return Response.json({ settings, availability });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
