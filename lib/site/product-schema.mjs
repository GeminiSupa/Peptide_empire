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
    addressCountry: 'CR',
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

export function productSchema({ compound, category, shelf, variant, schemaUrl, exchangeRate }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: compound.name,
    brand: { '@type': 'Brand', name: 'Peptides Costa Rica' },
    category: category ? category.name : shelf,
    image: variant?.image || compound.image || undefined,
    url: schemaUrl,
    offers: compound.variants.map((entry) => ({
      '@type': 'Offer',
      name: `${compound.name} ${entry.size}`.trim(),
      price: Math.round(entry.priceUsd * exchangeRate),
      priceCurrency: 'CRC',
      availability: entry.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      shippingDetails: costaRicaShipping(entry.priceUsd),
    })),
  };
}
