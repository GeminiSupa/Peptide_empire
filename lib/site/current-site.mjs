import { headers, cookies } from 'next/headers';
import { siteForHost, siteById, SITES } from './countries.mjs';

/**
 * The country for the current request. Resolved from the host
 * (peptidoscolombia.co, comprarpeptidosmexico.com, …); locally use a subdomain
 * like `mx.localhost:3000`, or set a `pe_site` cookie, to preview a country.
 *
 * Server-only (reads headers). React de-dupes it within a request.
 */
export async function currentSite() {
  try {
    const h = await headers();
    const forced = h.get('x-site');
    if (forced && SITES[forced]) return SITES[forced];
    try {
      const ck = await cookies();
      const cookieSite = ck.get('pe_site')?.value;
      if (cookieSite && SITES[cookieSite]) return SITES[cookieSite];
    } catch { /* cookies() can throw in some contexts */ }
    return siteForHost(h.get('host'));
  } catch {
    return siteById('co');
  }
}
