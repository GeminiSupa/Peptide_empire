import test from 'node:test';
import assert from 'node:assert/strict';

import { getCampaignSafetyConfig } from '../src/lib/campaignSafety.mjs';
import { nextWindowOpening, readSendWindow, withinSendWindow } from '../src/lib/broadcastPacing.mjs';

test('campaigns default to reputation-recovery pacing', () => {
  assert.deepEqual(getCampaignSafetyConfig({}), {
    batchSize: 50,
    batchIntervalMinutes: 30,
    sendDelayMs: 1500,
    fallbackSendDelayMs: 2500,
    maxConnections: 1,
    sendBudgetMs: 240000,
    sendWindowStartHour: 8,
    sendWindowEndHour: 20,
  });
});

test('campaign pacing remains controllable through server environment settings', () => {
  const config = getCampaignSafetyConfig({
    EMAIL_CAMPAIGN_BATCH_SIZE: '25',
    EMAIL_CAMPAIGN_BATCH_INTERVAL_MINUTES: '60',
    EMAIL_CAMPAIGN_SEND_DELAY_MS: '2000',
    EMAIL_CAMPAIGN_FALLBACK_SEND_DELAY_MS: '3000',
    EMAIL_CAMPAIGN_SMTP_CONNECTIONS: '1',
    EMAIL_CAMPAIGN_SEND_BUDGET_MS: '180000',
  });

  assert.deepEqual(config, {
    batchSize: 25,
    batchIntervalMinutes: 60,
    sendDelayMs: 2000,
    fallbackSendDelayMs: 3000,
    maxConnections: 1,
    sendBudgetMs: 180000,
    sendWindowStartHour: 8,
    sendWindowEndHour: 20,
  });
});

test('invalid pacing values fall back to safe defaults', () => {
  const config = getCampaignSafetyConfig({
    EMAIL_CAMPAIGN_BATCH_SIZE: '0',
    EMAIL_CAMPAIGN_BATCH_INTERVAL_MINUTES: '-1',
    EMAIL_CAMPAIGN_SEND_DELAY_MS: 'invalid',
    EMAIL_CAMPAIGN_SMTP_CONNECTIONS: '0',
  });

  assert.equal(config.batchSize, 50);
  assert.equal(config.batchIntervalMinutes, 30);
  assert.equal(config.sendDelayMs, 1500);
  assert.equal(config.maxConnections, 1);
});

test('campaigns only send 8:00-20:00 Costa Rica time and resume at the next 8:00', () => {
  const config = getCampaignSafetyConfig({});
  const window = readSendWindow({ send_window_start_hour: config.sendWindowStartHour, send_window_end_hour: config.sendWindowEndHour });
  // Costa Rica is UTC-6 all year.
  assert.equal(withinSendWindow(window, Date.parse('2026-11-04T14:00:00Z')), true); // 08:00 CR
  assert.equal(withinSendWindow(window, Date.parse('2026-11-05T01:59:00Z')), true); // 19:59 CR
  assert.equal(withinSendWindow(window, Date.parse('2026-11-05T02:00:00Z')), false); // 20:00 CR
  assert.equal(withinSendWindow(window, Date.parse('2026-11-05T09:00:00Z')), false); // 03:00 CR
  assert.equal(
    new Date(nextWindowOpening(window, Date.parse('2026-11-05T03:30:00Z'))).toISOString(), // 21:30 CR
    '2026-11-05T14:00:00.000Z', // 08:00 CR next morning
  );
});

test('the campaign sending hours can be moved from the server environment', () => {
  const config = getCampaignSafetyConfig({ EMAIL_CAMPAIGN_SEND_WINDOW_START_HOUR: '9', EMAIL_CAMPAIGN_SEND_WINDOW_END_HOUR: '18' });
  assert.equal(config.sendWindowStartHour, 9);
  assert.equal(config.sendWindowEndHour, 18);
});
