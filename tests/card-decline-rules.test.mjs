import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CARD_DECLINE_LINES } from '../lib/storefront/content.mjs';
import { cardDeclineRules } from '../catalog/lib/cardDeclineRules.mjs';
import es from '../lib/storefront/es-dictionary.mjs';

test('the cart tells card customers exactly what the catalog does', () => {
  // Same rule on both sites: 3 tries, call the bank, then a 1-hour block.
  const en = cardDeclineRules('en');
  const spanish = cardDeclineRules('es');
  assert.deepEqual(CARD_DECLINE_LINES.map(([, line]) => line), en.lines);
  assert.deepEqual(CARD_DECLINE_LINES.map(([, line]) => es[line]), spanish.lines);
  assert.equal(es[en.title], spanish.title);
});

test('the cart shows the rules on the card option', () => {
  const cart = fs.readFileSync(new URL('../components/storefront/cart-sheet.js', import.meta.url), 'utf8');
  assert.match(cart, /CARD_DECLINE_LINES\.map/);
  assert.match(cart, /t\('If your bank declines the card'\)/);
});
