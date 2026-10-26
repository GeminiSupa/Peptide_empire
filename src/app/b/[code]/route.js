import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { catalogBaseUrl } from '@/lib/referralLink.mjs';
import { cleanReportUrl, parseStickerCode } from '@/lib/labBatches.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where a vial sticker's QR goes: /b/BPC10-2610-A
 *
 * The packing screen only reads the code at the end of this link. A customer
 * who points their phone at the sticker follows the link itself: when the
 * batch has a lab report link (Lab batches tab), they are sent to that report,
 * so a label QR shows the COA for the vial in their hand. Any other code lands
 * on the catalog rather than an error page. Swapping this redirect for a batch
 * page later needs no reprinted sticker.
 */
export async function GET(request, { params }) {
  const { code } = await params;
  const base = catalogBaseUrl(process.env);

  const wanted = parseStickerCode(code);
  if (!wanted) return NextResponse.redirect(base, 302);

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('product_batches')
      .select('coa_url')
      .eq('code', wanted)
      .limit(1);
    const report = cleanReportUrl(data?.[0]?.coa_url);
    if (report) return NextResponse.redirect(report, 302);
  } catch (err) {
    console.error('[b] batch lookup failed:', err);
  }
  return NextResponse.redirect(base, 302);
}
