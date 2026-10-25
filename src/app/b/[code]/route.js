import { NextResponse } from 'next/server';
import { catalogBaseUrl } from '@/lib/referralLink.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where a vial sticker's QR goes: /b/BPC10-2610-A
 *
 * The packing screen only reads the code at the end of this link. A customer
 * who points their phone at the sticker follows the link itself, and until the
 * customer batch page exists they land on the catalog rather than an error
 * page. Swapping this redirect for that page later needs no reprinted sticker.
 */
export async function GET() {
  return NextResponse.redirect(catalogBaseUrl(process.env), 302);
}
