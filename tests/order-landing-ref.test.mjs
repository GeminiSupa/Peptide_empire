import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLandingRef, LANDING_REF_MAX_LENGTH } from '../src/lib/landingRef.mjs';

// The landing ref is user-controlled text off a ?ref= query parameter, so it
// has to be bounded before it reaches the orders row — and a bad value must
// never fail an order, it just produces null.

test('keeps an ordinary landing slug', () => {
  assert.equal(sanitizeLandingRef('glptz_fb_oct'), 'glptz_fb_oct');
});

test('trims surrounding whitespace', () => {
  assert.equal(sanitizeLandingRef('  glptz  '), 'glptz');
});

test('empty, whitespace-only and missing values become null', () => {
  assert.equal(sanitizeLandingRef(''), null);
  assert.equal(sanitizeLandingRef('   '), null);
  assert.equal(sanitizeLandingRef(null), null);
  assert.equal(sanitizeLandingRef(undefined), null);
});

test('non-stringable values become null, never throw', () => {
  assert.equal(sanitizeLandingRef({}), null);
  assert.equal(sanitizeLandingRef([]), null);
  assert.equal(sanitizeLandingRef(true), null);
});

test('a number ref is accepted as text', () => {
  assert.equal(sanitizeLandingRef(1234), '1234');
});

test('an overlong value is capped, not rejected', () => {
  const long = 'a'.repeat(LANDING_REF_MAX_LENGTH + 50);
  const result = sanitizeLandingRef(long);
  assert.equal(result.length, LANDING_REF_MAX_LENGTH);
});
