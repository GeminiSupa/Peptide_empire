import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = await readFile(new URL('../src/app/catalog/page.js', import.meta.url), 'utf8');

test('checkout payment methods follow the customer-facing priority order', () => {
  const paymentGrid = catalog.slice(
    catalog.indexOf('className="payment-method-grid"'),
    catalog.indexOf('].map(method =>', catalog.indexOf('className="payment-method-grid"')),
  );
  const positions = ['whatsapp', 'card', 'sinpe', 'bank_transfer', 'ach', 'crypto']
    .map((method) => paymentGrid.indexOf(`value: '${method}'`));
  assert.ok(positions.every((position) => position >= 0), 'every payment method is present');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('Costa Rican bank transfer shows the requested bank marks without claiming exclusivity', () => {
  assert.match(catalog, /payment-bank-mark--bac">BAC/);
  assert.match(catalog, /payment-bank-mark--bn">BNCR/);
  assert.match(catalog, /payment-bank-mark--bcr">BCR/);
  assert.match(catalog, /Cualquier banco de Costa Rica/);
});
