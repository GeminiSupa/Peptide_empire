/**
 * Failover providers for campaign sending.
 *
 * Elastic Email is ALWAYS the primary sender. When it reports that its sending
 * quota is used up, the send rolls over — in order — to:
 *   1. Resend, a second BULK provider, for the remainder (no cap);
 *   2. Rackspace, only as a last resort and only for a small, capped number,
 *      because Rackspace is a mailbox host, not a bulk sender — a big blast
 *      through it would endanger the mailbox that receives our order mail.
 *
 * The whole failover is OFF unless EMAIL_CAMPAIGN_FALLBACK_ENABLED=true, so the
 * default behaviour stays exactly Elastic-only. Each provider must also be
 * configured (a Resend API key; Rackspace SMTP creds) before it joins the chain.
 *
 * This module is pure config + error classification; the actual sending lives
 * in campaignDelivery.js and resendCampaignSender.mjs.
 */

import { getOwnDomainSmtpConfig } from './ownDomainSmtp.mjs';

const read = (env, name) => {
  const raw = env?.[name];
  return typeof raw === 'string' ? raw.trim() : raw;
};

const DEFAULT_RACKSPACE_CAP = 200;

export function campaignFallbackEnabled(env = process.env) {
  return String(read(env, 'EMAIL_CAMPAIGN_FALLBACK_ENABLED') || '').toLowerCase() === 'true';
}

// Phrases a provider uses to say "you are out of allowance", as opposed to a
// bad address (hard bounce) or a one-off blip. This is the ONLY thing that
// rolls a send over to the next provider.
const QUOTA_PATTERNS = [
  /quota/i,
  /\b(daily|hourly|monthly|sending|send)\s+limit\b/i,
  /limit (reached|exceeded|hit)/i,
  /exceeded (your )?(sending )?limit/i,
  /out of (credits|quota)/i,
  /insufficient (credits|balance|quota)/i,
  /no (sending )?credits/i,
  /too many requests/i,
];

export function isQuotaExhausted(error) {
  const code = Number(error?.responseCode ?? error?.statusCode);
  // 402 Payment Required / 429 Too Many Requests are both "you've hit a limit".
  if (code === 402 || code === 429) return true;
  const text = `${error?.response || ''} ${error?.message || ''} ${error?.body || ''}`;
  return QUOTA_PATTERNS.some(pattern => pattern.test(text));
}

export function getResendCampaignConfig(env = process.env) {
  const apiKey = read(env, 'EMAIL_CAMPAIGN_RESEND_API_KEY') || read(env, 'RESEND_API_KEY');
  const from = read(env, 'EMAIL_CAMPAIGN_RESEND_FROM') || '';
  const baseUrl = read(env, 'RESEND_API_BASE_URL') || 'https://api.resend.com';
  return { apiKey, from, baseUrl, configured: Boolean(apiKey) };
}

function rackspaceCap(env) {
  const parsed = Number.parseInt(read(env, 'EMAIL_CAMPAIGN_RACKSPACE_CAP'), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_RACKSPACE_CAP;
}

/**
 * The ordered providers to try AFTER Elastic. Empty when the failover is off
 * or nothing downstream is configured — which is the default, and keeps the
 * send Elastic-only exactly as before.
 */
export function resolveCampaignFallbackChain(env = process.env) {
  if (!campaignFallbackEnabled(env)) return [];

  const chain = [];
  const resend = getResendCampaignConfig(env);
  if (resend.configured) {
    chain.push({ kind: 'resend', provider: 'Resend', config: resend, cap: Infinity });
  }
  const rackspace = getOwnDomainSmtpConfig(env);
  if (rackspace.configured) {
    chain.push({ kind: 'smtp', provider: 'Rackspace', config: rackspace, cap: rackspaceCap(env) });
  }
  return chain;
}
