import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SLOW_DOMAINS, emailDomain, isSlowDomain, orderFastFirst, parseSlowDomains,
} from '../src/lib/campaignDomainThrottle.mjs';

test('emailDomain pulls the lowercased domain, or empty on junk', () => {
  assert.equal(emailDomain('Person@Hotmail.com'), 'hotmail.com');
  assert.equal(emailDomain('  a@b.CO  '), 'b.co');
  assert.equal(emailDomain('not-an-email'), '');
  assert.equal(emailDomain(''), '');
  assert.equal(emailDomain(null), '');
});

test('the Microsoft and Apple families are slow; Gmail and the rest are not', () => {
  for (const slow of ['a@hotmail.com', 'b@outlook.com', 'c@live.co.uk', 'd@icloud.com', 'e@me.com']) {
    assert.equal(isSlowDomain(slow, DEFAULT_SLOW_DOMAINS), true, slow);
  }
  for (const fast of ['a@gmail.com', 'b@yahoo.com', 'c@proton.me', 'd@company.cr']) {
    assert.equal(isSlowDomain(fast, DEFAULT_SLOW_DOMAINS), false, fast);
  }
});

test('an empty slow list means nothing is throttled', () => {
  assert.equal(isSlowDomain('a@hotmail.com', []), false);
  assert.equal(isSlowDomain('a@hotmail.com', parseSlowDomains('')), false);
});

test('parseSlowDomains trims, lowercases, and keeps the default when unset', () => {
  assert.deepEqual(parseSlowDomains('Hotmail.com , OUTLOOK.com'), ['hotmail.com', 'outlook.com']);
  assert.deepEqual(parseSlowDomains(undefined), [...DEFAULT_SLOW_DOMAINS]);
  assert.deepEqual(parseSlowDomains(null), [...DEFAULT_SLOW_DOMAINS]);
  assert.deepEqual(parseSlowDomains('   '), []);
});

test('orderFastFirst moves slow domains to the back but keeps relative order', () => {
  const targets = [
    { id: 1, email: 'one@hotmail.com' },
    { id: 2, email: 'two@gmail.com' },
    { id: 3, email: 'three@icloud.com' },
    { id: 4, email: 'four@yahoo.com' },
    { id: 5, email: 'five@gmail.com' },
  ];
  assert.deepEqual(
    orderFastFirst(targets, DEFAULT_SLOW_DOMAINS).map(t => t.id),
    [2, 4, 5, 1, 3],
  );
});

test('orderFastFirst is a no-op when the throttle is off', () => {
  const targets = [{ id: 1, email: 'a@hotmail.com' }, { id: 2, email: 'b@gmail.com' }];
  assert.deepEqual(orderFastFirst(targets, []).map(t => t.id), [1, 2]);
});
