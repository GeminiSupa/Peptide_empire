import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The vendored pricing modules must stay byte-identical to the catalog's.
 *
 * `lib/catalog-pricing/` holds verbatim copies of four files from the catalog
 * (see its README). The storefront shows a shopper a total using them, and
 * `/api/orders/create` refuses an order whose total disagrees with the one it
 * computes — so the moment these drift, the shop starts showing numbers
 * checkout will reject.
 *
 * This test compares them against the catalog checkout when it is on disk
 * beside this one. On a machine or CI runner that has only this branch, there
 * is nothing to compare against and the test says so rather than passing
 * quietly or failing for the wrong reason.
 */

const here = dirname(fileURLToPath(import.meta.url));
const vendored = join(here, '..', 'lib', 'catalog-pricing');

/** Where the catalog checkout sits relative to this worktree. */
const CATALOG_LIB = join(here, '..', '..', 'peptidecosta', 'src', 'lib');

const COPIES = [
  ['pricing.mjs', 'pricing.js'],
  ['bacWater.mjs', 'bacWater.mjs'],
  ['bulkDeal.mjs', 'bulkDeal.mjs'],
  ['fallbackExchangeRate.mjs', 'fallbackExchangeRate.mjs'],
];

async function read(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

const digest = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

test('the vendored pricing modules match the catalog\'s, byte for byte', async (t) => {
  const probe = await read(join(CATALOG_LIB, 'pricing.js'));
  if (probe === null) {
    t.skip(`catalog checkout not found at ${CATALOG_LIB} — nothing to compare against`);
    return;
  }

  for (const [copy, original] of COPIES) {
    const ours = await read(join(vendored, copy));
    const theirs = await read(join(CATALOG_LIB, original));

    assert.ok(ours !== null, `lib/catalog-pricing/${copy} is missing`);
    assert.ok(theirs !== null, `the catalog's ${original} is missing`);
    assert.equal(
      digest(ours),
      digest(theirs),
      `lib/catalog-pricing/${copy} has drifted from the catalog's ${original}. `
      + 'Re-copy it rather than editing it here — the shop must price exactly as checkout does.',
    );
  }
});

test('the vendored modules are not edited to import from outside their folder', async () => {
  // A relative import reaching out of this directory would make the copies
  // non-portable and hide a drift from the test above.
  for (const [copy] of COPIES) {
    const source = await read(join(vendored, copy));
    assert.ok(source !== null, `lib/catalog-pricing/${copy} is missing`);
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(
        specifier.startsWith('./'),
        `${copy} imports ${specifier}; vendored copies may only import their siblings`,
      );
    }
  }
});

test('the rules the storefront depends on are the ones the catalog states', async () => {
  const { FREE_SHIPPING_USD_THRESHOLD, getVolumeDiscountPct } = await import('../lib/catalog-pricing/pricing.mjs');
  const { STANDARD_FIVE_PLUS_PCT } = await import('../lib/catalog-pricing/bulkDeal.mjs');

  assert.equal(FREE_SHIPPING_USD_THRESHOLD, 200);
  assert.equal(STANDARD_FIVE_PLUS_PCT, 15);
  assert.equal(getVolumeDiscountPct(4), 0);
  assert.equal(getVolumeDiscountPct(5), 15);
  // 10+ is time-dependent in the catalog: a bulk-deal week raises it. Whatever
  // it is, it must be at least the standing 20% and never below the 5+ rate.
  const tenPlus = getVolumeDiscountPct(10);
  assert.ok(tenPlus >= 20, `10+ discount was ${tenPlus}`);
  assert.ok(tenPlus >= getVolumeDiscountPct(5));
});
