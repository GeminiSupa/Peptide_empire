export const DEFAULT_ENGAGEMENT_WINDOW_DAYS = 90;

export function normalizeEngagementWindowDays(value) {
  const days = Number(value || DEFAULT_ENGAGEMENT_WINDOW_DAYS);
  if (!Number.isFinite(days)) return DEFAULT_ENGAGEMENT_WINDOW_DAYS;
  return Math.max(1, Math.min(365, days));
}

export function engagedSubscriberIds(opens = [], clicks = []) {
  return [...new Set([...opens, ...clicks].map(row => row?.subscriber_id).filter(Boolean))];
}
