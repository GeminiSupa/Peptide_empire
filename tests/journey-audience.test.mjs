import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENGAGEMENT_WINDOW_DAYS,
  engagedSubscriberIds,
  normalizeEngagementWindowDays,
} from '../src/lib/journeyAudience.mjs';

test('engagedSubscriberIds combines opens and clicks without duplicates', () => {
  assert.deepEqual(
    engagedSubscriberIds(
      [{ subscriber_id: 'open-only' }, { subscriber_id: 'both' }, { subscriber_id: null }],
      [{ subscriber_id: 'both' }, { subscriber_id: 'click-only' }],
    ),
    ['open-only', 'both', 'click-only'],
  );
});

test('normalizeEngagementWindowDays defaults and clamps the audience window', () => {
  assert.equal(normalizeEngagementWindowDays(undefined), DEFAULT_ENGAGEMENT_WINDOW_DAYS);
  assert.equal(normalizeEngagementWindowDays('not-a-number'), DEFAULT_ENGAGEMENT_WINDOW_DAYS);
  assert.equal(normalizeEngagementWindowDays(0), DEFAULT_ENGAGEMENT_WINDOW_DAYS);
  assert.equal(normalizeEngagementWindowDays(-2), 1);
  assert.equal(normalizeEngagementWindowDays(500), 365);
  assert.equal(normalizeEngagementWindowDays(45), 45);
});
