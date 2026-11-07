import assert from 'node:assert/strict';
import test from 'node:test';
import { freeBacWaterImage } from '../lib/storefront/cart-display.mjs';

test('the cart uses the live 3 ml BAC Water image for its free gift', () => {
  const compounds = [{
    slug: 'bac-water',
    name: 'BAC Water',
    image: 'fallback.webp',
    variants: [
      { size: '10 ml', image: 'ten.webp' },
      { size: '3 ml', image: 'three.webp' },
    ],
  }];
  assert.equal(freeBacWaterImage(compounds), 'three.webp');
});

test('the free gift image falls back safely when the 3 ml row has no photo', () => {
  assert.equal(freeBacWaterImage([{ slug: 'bac-water', image: 'bac.webp', variants: [] }]), 'bac.webp');
  assert.equal(freeBacWaterImage([]), '');
});
