import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cardDeclineRules, CARD_TRIES_PER_ORDER, CARD_TRY_BLOCK_MINUTES } from '../src/lib/cardDeclineRules.mjs';
import { cardCheckoutMessage } from '../src/lib/cardCheckoutMessages.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('the customer is told the same limit the card route enforces', () => {
  const route = read('../src/app/api/chargx/process-card/route.js');
  const m = route.match(/bucket: 'card-attempt-order', key: orderNumber, limit: (\d+), windowSeconds: 60 \* (\d+),/);
  assert.ok(m, 'per-order card limit not found in the route');
  assert.equal(Number(m[1]), CARD_TRIES_PER_ORDER);
  assert.equal(Number(m[2]), CARD_TRY_BLOCK_MINUTES);
});

test('both languages say 3 tries, call the bank, then 1 hour', () => {
  const en = cardDeclineRules('en').lines.join(' ');
  assert.match(en, /3 tries/);
  assert.match(en, /call your bank/);
  assert.match(en, /blocked for 1 hour/);
  const es = cardDeclineRules('es').lines.join(' ');
  assert.match(es, /3 intentos/);
  assert.match(es, /llame a su banco/);
  assert.match(es, /1 hora/);
});

test('the block message names the same numbers and still lets them retry', () => {
  for (const lang of ['en', 'es']) {
    const { message, retryable } = cardCheckoutMessage('rate_limited', lang);
    assert.match(message, /\b3\b/);
    assert.match(message, /1 (hour|hora)/);
    assert.equal(retryable, true);
  }
});

test('the rules are shown on the checkout, the card page and the decline help page', () => {
  for (const page of ['../src/app/catalog/page.js', '../src/app/pay-card/page.js', '../src/app/payment-help/page.js']) {
    assert.match(read(page), /cardDeclineRules\(lang\)/, page);
  }
});
