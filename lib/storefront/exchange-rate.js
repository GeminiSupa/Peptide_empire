import { cache } from 'react';
import { FALLBACK_EXCHANGE_RATE, isPlausibleRate } from '@/lib/catalog-pricing/pricing.mjs';
import { catalogUrl } from '@/lib/storefront/catalog-origin.mjs';

/**
 * The USD -> CRC rate the storefront prices colones at.
 *
 * It is read from the catalog's `/api/exchange-rate`, which is the rate
 * checkout itself will use. Working one out here from an FX provider would be
 * a second rate: the shopper would be shown colón totals derived from one
 * number and charged totals derived from another, and checkout would refuse
 * the order for disagreeing with itself.
 *
 * A rate that cannot be read, or that falls outside the catalog's own
 * plausible band, falls back to the catalog's emergency constant. That can
 * disagree with the live rate, and when it does checkout answers
 * `409 price_changed` and the order is re-posted at the server's figure — see
 * `lib/storefront/order.js`.
 */
export const getUsdToCrcRate = cache(async () => {
  try {
    const response = await fetch(catalogUrl('/api/exchange-rate'), {
      // Short: a slow FX read must not hold up rendering the shop.
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`exchange-rate ${response.status}`);

    const { rate } = await response.json();
    if (!isPlausibleRate(rate)) throw new Error(`implausible rate ${rate}`);
    return Number(rate);
  } catch (error) {
    console.warn(
      `[storefront] using the fallback exchange rate (${FALLBACK_EXCHANGE_RATE}): ${error.message}`,
    );
    return FALLBACK_EXCHANGE_RATE;
  }
});
