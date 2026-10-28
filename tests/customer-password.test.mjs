import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordValidation, isRecentCustomerSignIn } from '../src/lib/customerPassword.mjs';

test('password changes require matching long passwords without trimming user input', () => {
  assert.ok(passwordValidation('short', 'short', 'en'));
  assert.ok(passwordValidation('a'.repeat(129), 'a'.repeat(129), 'en'));
  assert.ok(passwordValidation('a'.repeat(12), 'b'.repeat(12), 'en'));
  assert.equal(passwordValidation('a'.repeat(12), 'a'.repeat(12)), null);
  assert.equal(passwordValidation('a'.repeat(128), 'a'.repeat(128)), null);
  assert.equal(passwordValidation('  a long passphrase  ', '  a long passphrase  '), null);
  assert.match(passwordValidation('short', 'short', 'es'), /contraseña/);
});

test('password settings require a recent confirmed account sign-in', () => {
  const now = Date.parse('2026-10-28T00:00:00Z');
  assert.equal(isRecentCustomerSignIn({ last_sign_in_at: new Date(now - 600000).toISOString() }, now), true);
  assert.equal(isRecentCustomerSignIn({ last_sign_in_at: new Date(now - 600001).toISOString() }, now), false);
  assert.equal(isRecentCustomerSignIn({ last_sign_in_at: new Date(now + 1).toISOString() }, now), false);
  assert.equal(isRecentCustomerSignIn({}, now), false);
});
