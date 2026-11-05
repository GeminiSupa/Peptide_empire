import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendWhatsAppReference,
  createWhatsAppReference,
  extractWhatsAppReference,
} from '../src/lib/whatsappGoogleAttribution.mjs';
import { captureAdClick, readAdClick } from '../src/lib/adClickAttribution.mjs';

test('Google click identifiers are captured in a shared 90-day first-party cookie', () => {
  const now = Date.now();
  const document = { cookie: '' };
  const location = {
    search: '?gclid=google-click-123&utm_source=google',
    hostname: 'catalog.peptidescostarica.net',
    protocol: 'https:',
  };
  captureAdClick(location, document, now);
  assert.match(document.cookie, /Max-Age=7776000/);
  assert.match(document.cookie, /Domain=.peptidescostarica.net/);
  assert.equal(readAdClick(document, now).gclid, 'google-click-123');
});

test('the WhatsApp handoff exposes only an opaque reference', () => {
  const token = createWhatsAppReference();
  assert.match(token, /^[A-HJ-NP-Z2-9]{12}$/);
  const message = appendWhatsAppReference('Hola, me interesa', token);
  assert.equal(extractWhatsAppReference(message), token);
  assert.match(message, /Ref: PCR-/);
  assert.doesNotMatch(message, /gclid|google-click|utm_/i);
});

test('unrelated customer messages cannot claim attribution', () => {
  assert.equal(extractWhatsAppReference('Hola, quiero información'), null);
  assert.equal(extractWhatsAppReference('Ref: PCR-TOO-SHORT'), null);
});
