import {
  FLAT_SHIPPING_CRC,
  FREE_SHIPPING_USD_THRESHOLD,
} from '../catalog-pricing/pricing.mjs';

const costaRicaShipping = (priceUsd) => ({
  '@type': 'OfferShippingDetails',
  shippingRate: {
    '@type': 'MonetaryAmount',
    value: Number(priceUsd) >= FREE_SHIPPING_USD_THRESHOLD ? 0 : FLAT_SHIPPING_CRC,
    currency: 'CRC',
  },
  shippingDestination: {
    '@type': 'DefinedRegion',
    addressCountry: 'CO',
  },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: {
      '@type': 'QuantitativeValue',
      minValue: 1,
      maxValue: 2,
      unitCode: 'DAY',
    },
    transitTime: {
      '@type': 'QuantitativeValue',
      minValue: 1,
      maxValue: 2,
      unitCode: 'DAY',
    },
  },
});

/**
 * The Product node for a product page. Each offer's price is the colón price
 * the page shows and checkout charges (`priceCrc`, from the catalog's own
 * pricing); only a variant without one falls back to USD × rate.
 */
export function productSchema({ compound, category, shelf, variant, schemaUrl, exchangeRate, description }) {
  const image = variant?.image || compound.image || undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...(schemaUrl ? { '@id': `${schemaUrl}#product` } : {}),
    name: compound.name,
    ...(description ? { description } : {}),
    brand: { '@type': 'Brand', name: 'Peptidos Colombia' },
    category: category ? category.name : shelf,
    image: image && schemaUrl ? new URL(image, schemaUrl).toString() : image,
    url: schemaUrl,
    offers: compound.variants.map((entry) => ({
      '@type': 'Offer',
      name: `${compound.name} ${entry.size}`.trim(),
      price: Number.isFinite(entry.priceCrc) && entry.priceCrc > 0 ? entry.priceCrc : Math.round(entry.priceUsd * exchangeRate),
      priceCurrency: 'CRC',
      ...(schemaUrl ? { url: schemaUrl } : {}),
      itemCondition: 'https://schema.org/NewCondition',
      availability: entry.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      shippingDetails: costaRicaShipping(entry.priceUsd),
    })),
  };
}
