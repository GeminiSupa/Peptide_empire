import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBusinessLinks } from '../src/lib/businessLinks.js';

// +506 8404-6973 was retired on 9 Nov 2026; the saved admin row still held it.
test('a retired WhatsApp number saved in the admin is replaced by the current one', () => {
  const links = normalizeBusinessLinks({ whatsappNumber: '50684046973', whatsappDisplay: '+506 8404-6973' });
  assert.equal(links.whatsappNumber, '50660604775');
  assert.equal(links.whatsappDisplay, '+506 6060-4775');
});

test('any other number typed in the admin still wins', () => {
  const links = normalizeBusinessLinks({ whatsappNumber: '50611112222', whatsappDisplay: '+506 1111-2222' });
  assert.equal(links.whatsappNumber, '50611112222');
  assert.equal(links.whatsappDisplay, '+506 1111-2222');
});
