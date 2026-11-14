#!/usr/bin/env node
/** Keep the website storefront's pricing modules byte-identical to catalog. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const REF = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'origin/catalog';

const COPIES = {
  'src/lib/pricing.js': 'lib/catalog-pricing/pricing.mjs',
  'src/lib/bacWater.mjs': 'lib/catalog-pricing/bacWater.mjs',
  'src/lib/bulkDeal.mjs': 'lib/catalog-pricing/bulkDeal.mjs',
  'src/lib/fallbackExchangeRate.mjs': 'lib/catalog-pricing/fallbackExchangeRate.mjs',
  'src/lib/authoritativeCheckout.mjs': 'lib/catalog-pricing/authoritativeCheckout.mjs',
  'src/lib/dealOffers.mjs': 'lib/catalog-pricing/dealOffers.mjs',
  'src/lib/catalogFilters.mjs': 'lib/catalog-pricing/catalogFilters.mjs',
  'src/lib/promoEligibility.mjs': 'lib/catalog-pricing/promoEligibility.mjs',
  'src/lib/promoBadge.mjs': 'lib/catalog-pricing/promoBadge.mjs',
  'src/lib/checkoutBreakdown.mjs': 'lib/catalog-pricing/checkoutBreakdown.mjs',
};

const readSource = (file) => execFileSync('git', ['show', `${REF}:${file}`], { cwd: ROOT, maxBuffer: 1 << 24 });
const normalized = (buffer) => buffer.toString('utf8').replace(/\r\n/g, '\n');
const drift = [];

for (const [source, destination] of Object.entries(COPIES)) {
  const wanted = readSource(source);
  const output = path.join(ROOT, destination);
  const current = fs.existsSync(output) ? fs.readFileSync(output) : null;
  if (current && normalized(current) === normalized(wanted)) continue;
  if (CHECK) {
    drift.push(destination);
    continue;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, wanted);
}

if (drift.length) {
  console.error(`Catalog pricing copy has drifted from ${REF}:\n  ${drift.join('\n  ')}\nRun: node scripts/sync-catalog-pricing.mjs`);
  process.exit(1);
}

console.log(CHECK
  ? `Catalog pricing copy matches ${REF}: ${Object.keys(COPIES).length} files.`
  : `Copied ${Object.keys(COPIES).length} pricing files from ${REF}.`);
