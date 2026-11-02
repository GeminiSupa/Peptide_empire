import { cache } from 'react';
import { catalogUrl } from '@/lib/storefront/catalog-origin.mjs';

/**
 * The live Deal of the Week, read from the catalog's public
 * `/api/deals/current` — the same endpoint the catalog's own storefront reads,
 * and the deal its checkout prices against. The deal is set in the CRM's Deal
 * of the Week screen; nothing about it is configured on this site.
 *
 * Returns `{ deal, weekly }`:
 *   - `deal` is every live promotion pooled into one, which is what pricing
 *     must use (checkout charges the best offer across all of them);
 *   - `weekly` is the Deal of the Week alone, which is what the bar, the hero
 *     card and the deal page describe.
 *
 * Both are null when no deal runs, or when the catalog cannot be reached. A
 * missing deal only hides the promotion; checkout still prices the order with
 * whatever is live, so a failed read can never undercharge or overcharge.
 */
export const getLiveDeal = cache(async () => {
  try {
    const response = await fetch(catalogUrl('/api/deals/current'), {
      next: { revalidate: 60 },
      // The catalog reads the deals table on every call, so this answers
      // slower than the exchange rate; 4s timed out under a cold dev build.
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`deals/current ${response.status}`);
    const body = await response.json();
    return { deal: body.deal || null, weekly: body.weekly || null };
  } catch (error) {
    console.warn(`[site] Deal of the Week unavailable: ${error.message}`);
    return { deal: null, weekly: null };
  }
});
