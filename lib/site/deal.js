import { cache } from 'react';
import { catalogUrl } from '@/lib/storefront/catalog-origin.mjs';

/**
 * The live Deal of the Week, read from the catalog's public
 * `/api/deals/current` — the same endpoint the catalog's own storefront reads,
 * and the deal its checkout prices against. The deal is set in the CRM's Deal
 * of the Week screen; nothing about it is configured on this site.
 *
 * Returns `{ deal, weekly, flash }`:
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
  // Colombia has no deal running yet, so show none. The deal feature stays
  // fully intact — the bar, the hero card and the deal page all appear again
  // the moment this returns a live deal. Wire it to the empire's own deal
  // source when one exists. (Previously read the Costa Rica catalog's
  // /api/deals/current; removed so the site never shows a borrowed CR deal.)
  return { deal: null, weekly: null, flash: null };
});
