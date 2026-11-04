import { cache } from 'react';
import { getStorefrontCatalog } from '@/lib/storefront/feed';
import { getLiveDeal } from '@/lib/site/deal';
import { getReviewScores } from '@/lib/site/reviews.mjs';
import { describeDeal } from '@/lib/site/deal-view.mjs';
import {
  CATEGORIES,
  NEW_PAGES,
  categoryHref,
  compoundHref,
  pageHref,
} from '@/lib/site/links.mjs';
import { FREE_SHIPPING_USD_THRESHOLD } from '@/lib/catalog-pricing/pricing.mjs';
import { formatMoney } from '@/lib/storefront/i18n.mjs';

const PAGE_KEYS = [
  'home', 'catalog', 'shop', 'about', 'our-story', 'bulk-discounts',
  'lab-tests-coa-results', 'affiliate-program', 'faq-costa-rica',
  'contact-costa-rica', 'blog', 'info-center', 'peptide-guides',
  'customer-feedback', 'our-service-locations', 'privacy-policy',
  'shipping-policy', 'return-refund-policy', 'html-sitemap',
  ...Object.keys(NEW_PAGES),
];

/** Every page key's path in `lang`, for the chrome's links. */
export function siteLinks(lang) {
  return Object.fromEntries(PAGE_KEYS.map((key) => [key, pageHref(key, lang)]));
}

/**
 * A compound as the browser needs it: no long descriptions (they are rendered
 * on the server where a page shows them), plus its product page URL.
 */
function clientCompound(compound, lang) {
  const { descriptionEn, descriptionEs, ...rest } = compound;
  return { ...rest, href: compoundHref(compound, lang) };
}

/**
 * Everything the new design's chrome needs, read once per request: the live
 * catalog, the exchange rate, the deal, and the menus built from them.
 */
export const getSiteData = cache(async (lang) => {
  const [{ compounds, exchangeRate, ok }, { deal, weekly }, reviews] = await Promise.all([
    getStorefrontCatalog(),
    getLiveDeal(),
    getReviewScores(),
  ]);

  const client = compounds.map((compound) => clientCompound(compound, lang));
  const byName = new Map(client.map((compound) => [compound.name, compound]));

  const categories = CATEGORIES.map((category) => ({
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    href: categoryHref(category, lang),
    compounds: category.compounds.map((name) => byName.get(name)).filter(Boolean),
  }));

  const products = client
    .filter((compound) => !compound.href.includes('?'))
    .map((compound) => ({ name: compound.name, href: compound.href }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const popular = client
    .filter((compound) => compound.best)
    .slice(0, 4)
    .map((compound) => ({ name: compound.name, href: compound.href, image: compound.image }));

  const threshold = FREE_SHIPPING_USD_THRESHOLD;
  return {
    ok,
    exchangeRate,
    compounds: client,
    deal,
    dealView: describeDeal(weekly, lang),
    categories,
    products,
    popular,
    links: siteLinks(lang),
    reviews,
    freeShippingLabel: formatMoney(Math.round(threshold * exchangeRate), threshold, 'CRC'),
  };
});

/** "from" price of a compound, both currencies. */
export function fromPrice(compound) {
  const cheapest = compound.variants.reduce((best, variant) => (
    !best || variant.priceUsd < best.priceUsd ? variant : best
  ), null);
  return { crc: cheapest?.priceCrc || 0, usd: cheapest?.priceUsd || 0 };
}

/** The deal card's "Most ordered this week": the first three best sellers in stock. */
export function dealPicks(compounds) {
  return compounds.filter((compound) => compound.best && compound.inStock).slice(0, 3).map((compound) => {
    const from = fromPrice(compound);
    return { name: compound.name, href: compound.href, image: compound.image, fromCrc: from.crc, fromUsd: from.usd };
  });
}
