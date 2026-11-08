// Copied from the catalog (src/app/api/bank-payments/settings/route.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { getSupabaseAdmin } from '@/catalog/lib/supabaseAdmin';
import { bankAvailability, readBankSettings } from '@/catalog/lib/bankPayments.mjs';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(bankAvailability(await readBankSettings(getSupabaseAdmin())), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ sinpe: false, bank_transfer: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
