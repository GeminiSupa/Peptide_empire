import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShopperApprovedSeal, parseTrustpilot } from '../lib/site/reviews.mjs';

test('the Trustpilot score and count come from its TrustBox data', () => {
  assert.deepEqual(parseTrustpilot({ businessUnit: { trustScore: 4.6, numberOfReviews: { total: 34 } } }), { score: 4.6, count: 34 });
  assert.equal(parseTrustpilot({}), null);
});

test('the Shopper Approved score and count are read off its live seal', () => {
  const seal = `<text id="Rating" fill="#333"><tspan x="51" y="35">4.8</tspan></text>
    <text id="(" fill="#333"><tspan x="101" y="32">(</tspan></text>
    <text id="100" fill="#333"><tspan x="107" y="35">30</tspan></text>`;
  assert.deepEqual(parseShopperApprovedSeal(seal), { score: 4.8, count: 30 });
  assert.equal(parseShopperApprovedSeal('<svg></svg>'), null);
});
