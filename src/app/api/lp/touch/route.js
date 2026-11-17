import { NextResponse } from 'next/server';
import { captureTouch } from '@/lib/touchTracker.mjs';

export const dynamic = 'force-dynamic';

// Revenue by channel for the Google/TikTok ad pages (public/lp/*/index.html).
// Those pages are static files, so the app's EcommerceTracker never runs on
// them and a visit from an ad was never saved in the `pcr_touch` cookie: an
// order placed there reached checkout with no source at all.
//
// The page posts its own address and referrer here once per load, and this
// runs the very same captureTouch the rest of the site uses, against the
// request's cookies, then hands back the cookie it wrote. One implementation,
// so the ad pages cannot drift from the app on how a visit is classified.
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

  // The state goes back to the page too: on the main site the order is posted
  // to the catalog's address, where the browser sends no cookie, so the page
  // carries it in the order as `touch` (the order route accepts that).
  const response = NextResponse.json({ touch: state || null }, { headers: { 'Cache-Control': 'no-store' } });
  if (written) response.headers.append('Set-Cookie', written);
  return response;
}
