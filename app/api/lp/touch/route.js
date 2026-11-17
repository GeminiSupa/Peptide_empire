import { NextResponse } from 'next/server';
import { captureTouch } from '@/lib/catalog-attribution/touchTracker.mjs';

export const dynamic = 'force-dynamic';

/**
 * Revenue by channel for the Google Ads landing pages under /lp/.
 *
 * Those pages are static copies of the catalog's (scripts/sync-landing-pages.mjs),
 * so the site's visitor tracker never runs on them. Each page posts its address
 * and referrer here once per load; this runs the catalog's own captureTouch (the
 * vendored copy in lib/catalog-attribution) against the request's cookies, sets
 * the shared `pcr_touch` cookie and hands the state back. The page sends that
 * state with its order as `touch`, because the order goes to the catalog's
 * address and the browser sends it no cookie. Same contract as the catalog's
 * own /api/lp/touch.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(/:$/, '');
  let page;
  try {
    page = new URL(String(body.href || ''));
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  // Only the page this request came from: never a touch for another site.
  if (page.host !== host) return new NextResponse(null, { status: 204 });

  let written = '';
  const document = {
    referrer: String(body.referrer || '').slice(0, 500),
    get cookie() { return request.headers.get('cookie') || ''; },
    set cookie(value) { written = String(value || ''); },
  };
  const state = captureTouch({ href: page.href, hostname: page.hostname, protocol: `${protocol}:` }, document);

  const response = NextResponse.json({ touch: state || null }, { headers: { 'Cache-Control': 'no-store' } });
  if (written) response.headers.append('Set-Cookie', written);
  return response;
}
