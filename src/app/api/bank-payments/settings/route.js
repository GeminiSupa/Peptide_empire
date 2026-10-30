import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { bankAvailability, readBankSettings } from '@/lib/bankPayments.mjs';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(bankAvailability(await readBankSettings(getSupabaseAdmin())), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ sinpe: false, bank_transfer: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
