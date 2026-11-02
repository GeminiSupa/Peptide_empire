import test from 'node:test';
import assert from 'node:assert/strict';

import {
  leadBelongsInChatwoot,
  leadChatwootPhone,
} from '../src/lib/chatwootLeadEligibility.mjs';

test('paid ad and TikTok leads always belong in Chatwoot', () => {
  assert.equal(leadBelongsInChatwoot({ lead_source: 'adwords_lp' }), true);
  assert.equal(leadBelongsInChatwoot({ lead_source: 'glp1_lp' }), true);
  assert.equal(leadBelongsInChatwoot({ lead_source: 'tiktok_form' }), true);
});

test('a WhatsApp catalog opt-in with a phone belongs in Chatwoot', () => {
  assert.equal(leadBelongsInChatwoot({
    whatsapp_consent: true,
    contact_method: 'whatsapp',
    contact_value: '50688887777',
  }), true);
  assert.equal(leadBelongsInChatwoot({
    whatsapp_consent: true,
    phone: '50688887777',
  }), true);
  assert.equal(leadBelongsInChatwoot({
    whatsapp_consent: true,
    consent_source: 'catalog_gate',
    phone: '50688887777',
  }), true);
});

test('catalog leads without a WhatsApp opt-in and phone stay out', () => {
  assert.equal(leadBelongsInChatwoot({
    whatsapp_consent: true,
    contact_method: 'email',
    contact_value: 'ana@example.com',
  }), false);
  assert.equal(leadBelongsInChatwoot({
    whatsapp_consent: false,
    contact_method: 'whatsapp',
    contact_value: '50688887777',
  }), false);
  assert.equal(leadBelongsInChatwoot({ contact_method: 'email', contact_value: 'a@b.com' }), false);
  assert.equal(leadBelongsInChatwoot(null), false);
});

/* Still used for the contact we put on an ad lead's chat. */
test('leadChatwootPhone prefers phone, then WhatsApp contact_value', () => {
  assert.equal(leadChatwootPhone({ phone: '50611112222', contact_value: '50688887777' }), '50611112222');
  assert.equal(leadChatwootPhone({
    contact_method: 'whatsapp',
    contact_value: '50688887777',
  }), '50688887777');
  assert.equal(leadChatwootPhone({
    contact_method: 'email',
    contact_value: 'ana@example.com',
  }), '');
});
