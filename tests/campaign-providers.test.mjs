import test from 'node:test';
import assert from 'node:assert/strict';

import {
  campaignFallbackEnabled, getResendCampaignConfig, isQuotaExhausted, resolveCampaignFallbackChain,
} from '../src/lib/campaignProviders.mjs';
import { sendCampaignEmailViaResend } from '../src/lib/resendCampaignSender.mjs';

const RESEND = { EMAIL_CAMPAIGN_FALLBACK_ENABLED: 'true', RESEND_API_KEY: 're_test' };
const RACK = {
  OWN_DOMAIN_SMTP_HOST: 'secure.emailsrvr.com',
  OWN_DOMAIN_SMTP_USER: 'info@peptidescostarica.net',
  OWN_DOMAIN_SMTP_PASS: 'secret',
};

test('the failover only switches on with the explicit flag', () => {
  assert.equal(campaignFallbackEnabled({}), false);
  assert.equal(campaignFallbackEnabled({ EMAIL_CAMPAIGN_FALLBACK_ENABLED: 'false' }), false);
  assert.equal(campaignFallbackEnabled({ EMAIL_CAMPAIGN_FALLBACK_ENABLED: 'TRUE' }), true);
});

test('isQuotaExhausted catches "out of allowance", not bad addresses or blips', () => {
  assert.equal(isQuotaExhausted({ statusCode: 429 }), true);
  assert.equal(isQuotaExhausted({ statusCode: 402 }), true);
  assert.equal(isQuotaExhausted({ message: 'Daily sending limit reached' }), true);
  assert.equal(isQuotaExhausted({ message: 'You are out of credits' }), true);
  assert.equal(isQuotaExhausted({ response: 'too many requests, slow down' }), true);

  assert.equal(isQuotaExhausted({ responseCode: 550, message: 'user unknown' }), false);
  assert.equal(isQuotaExhausted({ message: 'connection reset' }), false);
  assert.equal(isQuotaExhausted({}), false);
});

test('Resend config reads either env name and is unconfigured without a key', () => {
  assert.equal(getResendCampaignConfig({}).configured, false);
  assert.equal(getResendCampaignConfig({ RESEND_API_KEY: 're_a' }).apiKey, 're_a');
  assert.equal(getResendCampaignConfig({ EMAIL_CAMPAIGN_RESEND_API_KEY: 're_b' }).apiKey, 're_b');
});

test('the chain is empty unless the flag is on AND a provider is configured', () => {
  assert.deepEqual(resolveCampaignFallbackChain({}), []);
  // flag on but nothing configured downstream → still empty (Elastic only)
  assert.deepEqual(resolveCampaignFallbackChain({ EMAIL_CAMPAIGN_FALLBACK_ENABLED: 'true' }), []);
  // configured but flag off → still empty
  assert.deepEqual(resolveCampaignFallbackChain({ ...RACK, RESEND_API_KEY: 're_x' }), []);
});

test('Resend overflow comes before the capped Rackspace valve', () => {
  const chain = resolveCampaignFallbackChain({ ...RESEND, ...RACK, EMAIL_CAMPAIGN_RACKSPACE_CAP: '150' });
  assert.deepEqual(chain.map(p => p.provider), ['Resend', 'Rackspace']);
  assert.equal(chain[0].cap, Infinity);           // Resend is a bulk provider
  assert.equal(chain[1].cap, 150);                 // Rackspace is a small valve
  assert.equal(chain[1].kind, 'smtp');
});

test('Rackspace cap defaults to 200 when unset', () => {
  const chain = resolveCampaignFallbackChain({ ...RESEND, ...RACK });
  assert.equal(chain.find(p => p.provider === 'Rackspace').cap, 200);
});

test('sendCampaignEmailViaResend posts the message and returns the id', async () => {
  let captured = null;
  const fakeFetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: 'resend-123' }) };
  };
  const result = await sendCampaignEmailViaResend(
    { apiKey: 're_test', from: 'PCR <info@peptidescostarica.net>', baseUrl: 'https://api.resend.com' },
    { to: 'a@gmail.com', subject: 'Hi', html: '<p>x</p>', replyTo: 'reply@x.com', headers: { 'List-Unsubscribe': '<u>' } },
    fakeFetch,
  );
  assert.equal(result.id, 'resend-123');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.to, ['a@gmail.com']);       // string coerced to array
  assert.equal(body.reply_to, 'reply@x.com');       // mapped to Resend's field name
  assert.equal(captured.options.headers.Authorization, 'Bearer re_test');
});

test('a Resend quota rejection throws an error isQuotaExhausted recognises', async () => {
  const fakeFetch = async () => ({
    ok: false, status: 429, json: async () => ({ message: 'Too many requests' }),
  });
  await assert.rejects(
    () => sendCampaignEmailViaResend({ apiKey: 're', baseUrl: 'https://api.resend.com' }, { to: 'a@b.com' }, fakeFetch),
    (error) => {
      assert.equal(error.statusCode, 429);
      assert.equal(isQuotaExhausted(error), true);
      return true;
    },
  );
});
