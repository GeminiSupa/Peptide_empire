import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeClickId, CLICK_ID_MAX_LENGTH } from '../src/lib/paidClickIds.mjs';

// ?cid= and ?ttclid= come off a query string, so they are user-controlled text
// on their way to a database column. A bad value must become null, never an
// error: a sale is worth more than its tracking tag.

test('a normal click id is kept as it is', () => {
  assert.equal(sanitizeClickId('E.C.P2_ABC-123'), 'E.C.P2_ABC-123');
});

test('whitespace is trimmed', () => {
  assert.equal(sanitizeClickId('  cid_abc123  '), 'cid_abc123');
});

test('nothing usable becomes null', () => {
  assert.equal(sanitizeClickId(''), null);
  assert.equal(sanitizeClickId('   '), null);
  assert.equal(sanitizeClickId(null), null);
  assert.equal(sanitizeClickId(undefined), null);
  assert.equal(sanitizeClickId({ cid: 'x' }), null);
  assert.equal(sanitizeClickId(['x']), null);
});

test('a number is accepted (some trackers send one)', () => {
  assert.equal(sanitizeClickId(12345), '12345');
});

test('a pathological value is capped, not refused', () => {
  const long = 'x'.repeat(CLICK_ID_MAX_LENGTH + 500);
  assert.equal(sanitizeClickId(long).length, CLICK_ID_MAX_LENGTH);
});
