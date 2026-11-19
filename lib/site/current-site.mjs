import { headers, cookies } from 'next/headers';
import { siteForHost, siteById, SITES } from './countries.mjs';

/**
 * The country for the current request.
 *
 * A deployment can be pinned to one country with the `NEXT_PUBLIC_SITE_ID`
 * environment variable (`co`, `mx`, `ar`, `ca`). That is how each country runs
 * as its own Vercel project: set it once in that project and the whole site —
 * including statically built pages, which never see a request host — serves
 * that country. With it unset, the country comes from the host instead
 * (peptidoscolombia.co, comprarpeptidosmexico.com, …), so one deployment can
 * still serve several domains; locally use a subdomain like `mx.localhost:3000`
 * or a `pe_site` cookie to preview a country.
 *
 * Server-only (reads headers). React de-dupes it within a request.
 */
export async function currentSite() {
  // A pinned deployment is one country, whatever the host or build context.
  const pinned = process.env.NEXT_PUBLIC_SITE_ID;
  if (pinned && SITES[pinned]) return SITES[pinned];
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
