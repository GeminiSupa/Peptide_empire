import { catalogUrl } from '@/lib/storefront/catalog-origin.mjs';

/**
 * Whether SINPE Móvil and bank transfer are switched on right now.
 *
 * The catalog's checkout reads this from its own `/api/bank-payments/settings`
 * (staff switch them in the admin). That route answers only the catalog's own
 * pages, so the website asks it from here, server to server, and the cart reads
 * this. Checkout re-checks the setting when the order arrives either way.
 *
 * Anything that goes wrong reads as "off", as it does in the catalog: an
 * option that cannot be confirmed is shown as coming soon, not offered.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  let methods = { sinpe: false, bank_transfer: false };
  try {
    const response = await fetch(catalogUrl('/api/bank-payments/settings'), {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const data = await response.json();
      methods = { sinpe: data?.sinpe === true, bank_transfer: data?.bank_transfer === true };
    }
  } catch (error) {
    console.warn('[bank-methods] could not read the catalog setting:', error?.message || error);
  }
  return Response.json(methods, { headers: { 'Cache-Control': 'no-store' } });
}
