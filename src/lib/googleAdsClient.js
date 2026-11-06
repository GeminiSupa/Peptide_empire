import { googleAdsDestination } from './googleAdsConversions.mjs';
export const GOOGLE_ADS_REQUIRED_ENV = ['GOOGLE_ADS_CUSTOMER_ID','GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID','GOOGLE_ADS_CARD_CONVERSION_ACTION_ID','GOOGLE_ADS_CLIENT_ID','GOOGLE_ADS_CLIENT_SECRET','GOOGLE_ADS_REFRESH_TOKEN'];
export async function googleAdsClient(env = process.env, fetcher = fetch) {
  const missing = GOOGLE_ADS_REQUIRED_ENV.filter(key => !env[key]); if (missing.length) throw new Error('Google Ads configuration missing: ' + missing.join(', '));
  const destinations = Object.fromEntries(['whatsapp','card'].map(method => [method, googleAdsDestination(env, method)]));
  const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN }) });
  const token = await tokenResponse.json(); if (!tokenResponse.ok || !token.access_token) throw new Error('Google OAuth refresh failed (HTTP ' + tokenResponse.status + ').');
  async function call(path, options = {}) {
    const res = await fetcher('https://datamanager.googleapis.com/v1/' + path, { ...options, signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' } });
    const data = await res.json(); if (!res.ok) throw new Error('Google Data Manager HTTP ' + res.status + ' (' + (data.error?.status || 'request failed') + ').');
    return data;
  }
  return {
    destination: env.GOOGLE_ADS_CUSTOMER_ID + ':' + env.GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID,
    destinations: new Set(Object.keys(destinations).map(method => env.GOOGLE_ADS_CUSTOMER_ID + ':' + (method === 'card' ? env.GOOGLE_ADS_CARD_CONVERSION_ACTION_ID : env.GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID))),
    destinationFor: method => env.GOOGLE_ADS_CUSTOMER_ID + ':' + (method === 'card' ? env.GOOGLE_ADS_CARD_CONVERSION_ACTION_ID : env.GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID),
    upload: (event, validateOnly = false, paymentMethod = 'whatsapp') => call('events:ingest', { method: 'POST', body: JSON.stringify({ destinations: [destinations[paymentMethod]], events: [event], encoding: 'HEX', validateOnly }) }),
    status: id => call('requestStatus:retrieve?requestId=' + encodeURIComponent(id)),
  };
}
