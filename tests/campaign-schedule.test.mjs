import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { fitToSendingHours } from '../src/lib/campaignSchedule.mjs';
import { crWallToIso } from '../src/lib/crTime.mjs';

const HOURS = { startHour: 8, endHour: 20 };
const at = (wall) => crWallToIso(wall);

test('a time inside sending hours is kept exactly as picked', () => {
  const out = fitToSendingHours(at('2026-11-05T19:00'), HOURS);
  assert.equal(out.scheduledFor, at('2026-11-05T19:00'));
  assert.equal(out.moved, false);
});

test('8:00 is inside and 20:00 is outside, because the end hour is exclusive', () => {
  assert.equal(fitToSendingHours(at('2026-11-05T08:00'), HOURS).moved, false);
  const late = fitToSendingHours(at('2026-11-05T20:00'), HOURS);
  assert.equal(late.moved, true);
  assert.equal(late.scheduledFor, at('2026-11-06T08:00'));
});

test('a night time waits for the next morning, not the same night', () => {
  const out = fitToSendingHours(at('2026-11-05T22:30'), HOURS);
  assert.equal(out.moved, true);
  assert.equal(out.scheduledFor, at('2026-11-06T08:00'));
});

test('a small-hours time waits for 8:00 the same day', () => {
  const out = fitToSendingHours(at('2026-11-05T04:00'), HOURS);
  assert.equal(out.moved, true);
  assert.equal(out.scheduledFor, at('2026-11-05T08:00'));
});

test('no schedule stays no schedule', () => {
  assert.deepEqual(fitToSendingHours(null, HOURS), { scheduledFor: null, moved: false, window: { start: 8, end: 20 } });
  assert.equal(fitToSendingHours(undefined, HOURS).scheduledFor, null);
});

test('an unreadable time is passed through rather than invented', () => {
  assert.equal(fitToSendingHours('not a date', HOURS).moved, false);
});

test('a full-day window never moves anything', () => {
  const out = fitToSendingHours(at('2026-11-05T03:00'), { startHour: 0, endHour: 24 });
  assert.equal(out.moved, false);
  assert.equal(out.scheduledFor, at('2026-11-05T03:00'));
});

// The picker used to read what was typed in the browser's own zone. An admin in
// Pakistan choosing "8 PM" scheduled it for 9 AM Costa Rica. Every other admin
// date goes through crWallToIso / isoToCrWall; this keeps the builder on them.
test('the campaign builder reads and writes its schedule in Costa Rica time', () => {
  const source = fs.readFileSync(new URL('../src/components/admin/marketing/CampaignBuilder.js', import.meta.url), 'utf8');
  assert.ok(source.includes('crWallToIso(scheduledAt)'), 'must convert the typed time with crWallToIso');
  assert.ok(source.includes('isoToCrWall(selectedCampaign.scheduled_for)'), 'must show the stored time with isoToCrWall');
  assert.ok(!/new Date\(scheduledAt\)/.test(source), 'must not read the typed time in the browser zone');
  assert.ok(!/scheduled_for\)\.toISOString\(\)\.slice/.test(source), 'must not show a UTC string as if it were local');
});
