export const DEFAULT_CAMPAIGN_SAFETY = Object.freeze({
  batchSize: 120,
  // 0 = chain straight into the next batch (the cron self-triggers) instead of
  // parking between batches. The 30-minute park used to be the whole reason an
  // 1,800-person send took ~8 hours. Set a positive value to re-introduce a
  // deliberate gap between batches.
  batchIntervalMinutes: 0,
  sendDelayMs: 800,
  fallbackSendDelayMs: 2500,
  maxConnections: 1,
  sendBudgetMs: 240000,
  // Campaigns only go out between these Costa Rica hours (start inclusive,
  // end exclusive). A batch due outside them waits for the next opening, so a
  // list that takes all afternoon does not keep mailing people through the night.
  sendWindowStartHour: 8,
  sendWindowEndHour: 20,
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// These server-only environment controls make campaign pacing adjustable
// without a deploy. The defaults now drain a campaign continuously (no park
// between batches); slow mailbox providers such as Hotmail/iCloud are meant to
// be protected by a per-domain throttle, not by making the whole list crawl.
// To pace the whole list more slowly again, raise EMAIL_CAMPAIGN_SEND_DELAY_MS
// or set EMAIL_CAMPAIGN_BATCH_INTERVAL_MINUTES above 0.
export function getCampaignSafetyConfig(env = process.env) {
  return {
    batchSize: positiveInteger(
      env.EMAIL_CAMPAIGN_BATCH_SIZE || env.EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SEND,
      DEFAULT_CAMPAIGN_SAFETY.batchSize,
    ),
    batchIntervalMinutes: nonNegativeInteger(
      env.EMAIL_CAMPAIGN_BATCH_INTERVAL_MINUTES,
      DEFAULT_CAMPAIGN_SAFETY.batchIntervalMinutes,
    ),
    sendDelayMs: nonNegativeInteger(
      env.EMAIL_CAMPAIGN_SEND_DELAY_MS,
      DEFAULT_CAMPAIGN_SAFETY.sendDelayMs,
    ),
    fallbackSendDelayMs: nonNegativeInteger(
      env.EMAIL_CAMPAIGN_FALLBACK_SEND_DELAY_MS,
      DEFAULT_CAMPAIGN_SAFETY.fallbackSendDelayMs,
    ),
    maxConnections: positiveInteger(
      env.EMAIL_CAMPAIGN_SMTP_CONNECTIONS,
      DEFAULT_CAMPAIGN_SAFETY.maxConnections,
    ),
    // Vercel kills the function at `maxDuration` (300s). Stop before that
    // wall and let the next scheduled batch continue the campaign.
    sendBudgetMs: positiveInteger(
      env.EMAIL_CAMPAIGN_SEND_BUDGET_MS,
      DEFAULT_CAMPAIGN_SAFETY.sendBudgetMs,
    ),
    sendWindowStartHour: nonNegativeInteger(
      env.EMAIL_CAMPAIGN_SEND_WINDOW_START_HOUR,
      DEFAULT_CAMPAIGN_SAFETY.sendWindowStartHour,
    ),
    sendWindowEndHour: nonNegativeInteger(
      env.EMAIL_CAMPAIGN_SEND_WINDOW_END_HOUR,
      DEFAULT_CAMPAIGN_SAFETY.sendWindowEndHour,
    ),
  };
}
