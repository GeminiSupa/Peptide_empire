import { NextResponse } from 'next/server';
import { getLandingPageProducts } from '@/lib/storefront/feed';

/**
 * Live prices and stock for the Google Ads landing pages under /lp/.
 *
 * Those pages are copies of the catalog's (scripts/sync-landing-pages.mjs) and
 * each one calls this on load. The catalog answers the same path with the same
 * body; this site serves its own so a page here needs nothing from
 * catalog.peptidescostarica.net — and because a cross-origin GET to the
 * catalog's copy would be blocked, it sends no CORS headers.
 *
 * The shape is the catalog's, field for field, so the page's own sync code is
 * copied verbatim: `dbBacked` false (or a 500) tells it to keep the snapshot it
 * shipped with rather than show nothing.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getLandingPageProducts();
    return NextResponse.json(
      { ok: true, dbBacked: true, products },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[api/lp/products] Could not load the live catalog:', error);
    return NextResponse.json({ ok: false, error: 'Could not load the live catalog' }, { status: 500 });
  }
}
