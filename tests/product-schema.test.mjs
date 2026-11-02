import test from 'node:test';
import assert from 'node:assert/strict';
import { productSchema } from '../lib/site/product-schema.mjs';

const compound = {
  name: 'Selank',
  image: 'https://example.com/selank.webp',
  variants: [
    { size: '10 mg', priceUsd: 90, inStock: true },
    { size: '30 mg', priceUsd: 240, inStock: false },
  ],
};

test('product offers publish Costa Rica shipping in the same CRC currency as their prices', () => {
  const schema = productSchema({
    compound,
    category: { name: 'Cognitive & Mood' },
    shelf: 'Other',
    variant: compound.variants[0],
    schemaUrl: 'https://peptidescostarica.net/selank-costa-rica/',
    exchangeRate: 450,
  });

  const paidShipping = schema.offers[0];
  assert.equal(paidShipping.price, 40500);
  assert.equal(paidShipping.priceCurrency, 'CRC');
  assert.deepEqual(paidShipping.shippingDetails.shippingRate, {
    '@type': 'MonetaryAmount',
    value: 2500,
    currency: paidShipping.priceCurrency,
  });
  assert.equal(paidShipping.shippingDetails.shippingDestination.addressCountry, 'CR');
  assert.deepEqual(paidShipping.shippingDetails.deliveryTime.handlingTime, {
    '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY',
  });
  assert.deepEqual(paidShipping.shippingDetails.deliveryTime.transitTime, {
    '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY',
  });

  assert.equal(schema.offers[1].shippingDetails.shippingRate.value, 0);
  assert.equal(schema.offers[1].shippingDetails.shippingRate.currency, schema.offers[1].priceCurrency);
});
