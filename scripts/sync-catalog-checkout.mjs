#!/usr/bin/env node
/**
 * Copies the catalog's checkout and payment code into this site, verbatim.
 *
 *   node scripts/sync-catalog-checkout.mjs           write the copy
 *   node scripts/sync-catalog-checkout.mjs --check   exit 1 if the copy has
 *                                                    drifted from the catalog
 *   --ref <git ref>                                  default origin/catalog
 *
 * Why a copy: this site has to take orders and payments on its own, so the
 * business keeps running if catalog.peptidescostarica.net goes away (THE GOAL
 * in AGENTS.md). Rewriting checkout would give two implementations that
 * price, save and charge differently. Copying the catalog's own files keeps
 * one implementation; this script keeps the two copies identical.
 *
 * What it does to each file, and nothing else:
 *   1. Imports `@/x` (the catalog's `src/x`) become `@/catalog/x`, so the
 *      helpers live under `catalog/` and cannot collide with this site's.
 *   2. Pages and API routes land at the paths in ROUTES below.
 *   3. The handful of edits in PATCHES. Each must match exactly once, so a
 *      change upstream that touches one stops the sync instead of being lost.
 *
 * Never hand-edit a file under catalog/ or a route listed here: fix it in the
 * catalog (branch catalog) and re-run this script.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const REF = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'origin/catalog';

/** catalog source → this site's path. Their imports are followed and copied. */
export const ROUTES = {
  // Checkout: the one door every order goes through.
  'src/app/api/orders/create/route.js': 'app/api/orders/create/route.js',
  // Card (ChargX), Bank (ACH) and Crypto.
  'src/app/api/card-payment-link/order/route.js': 'app/api/card-payment-link/order/route.js',
  'src/app/api/card-payment-link/pay/route.js': 'app/api/card-payment-link/pay/route.js',
  'src/app/api/chargx/process-card/route.js': 'app/api/chargx/process-card/route.js',
  'src/app/api/chargx/webhook/route.js': 'app/api/chargx/webhook/route.js',
  'src/app/api/givver/webhook/route.js': 'app/api/givver/webhook/route.js',
  // SINPE Móvil and bank transfer.
  'src/app/api/bank-payments/order/route.js': 'app/api/bank-payments/order/route.js',
  'src/app/api/bank-payments/settings/route.js': 'app/api/bank-payments/settings/route.js',
  // The purchase event the confirmation page fires.
  'src/app/api/analytics/order-receipt/route.js': 'app/api/analytics/order-receipt/route.js',
  // Called by URL, not import: checkout posts the order emails here, and the
  // pages' WhatsApp buttons go through this redirect.
  'src/app/api/order-notification/route.js': 'app/api/order-notification/route.js',
  'src/app/api/whatsapp/open/route.js': 'app/api/whatsapp/open/route.js',
  // Images the copied pages show.
  'public/logo.png': 'public/logo.png',
  'public/email-app-launch-en.jpg': 'public/email-app-launch-en.jpg',
  'public/email-app-launch-es.jpg': 'public/email-app-launch-es.jpg',
  // The pages a paying customer sees. (pay) is their own root layout, so the
  // catalog's stylesheet never reaches the rest of the site.
  'src/app/pay-card/page.js': 'app/(pay)/pay-card/page.js',
  'src/app/pay-card/[order]/[token]/page.js': 'app/(pay)/pay-card/[order]/[token]/page.js',
  'src/app/pay-bank/page.js': 'app/(pay)/pay-bank/page.js',
  'src/app/pay-bank/pay-bank.module.css': 'app/(pay)/pay-bank/pay-bank.module.css',
  // The catalog's /thank-you. This site already has a /thank-you/ (WhatsApp
  // orders, new design), so the card and bank confirmation moves to
  // /order-confirmation/ and the links to it are patched below.
  'src/app/thank-you/page.js': 'app/(pay)/order-confirmation/page.js',
  'src/app/thank-you/layout.js': 'app/(pay)/order-confirmation/layout.js',
  // The catalog's whole stylesheet, loaded only by the (pay) layout.
  'src/app/globals.css': 'catalog/globals.css',
  // Its fonts, loaded by app/(pay)/layout.js.
  'src/app/fonts/montserrat-latin-variable.woff2': 'app/(pay)/fonts/montserrat-latin-variable.woff2',
  'src/app/fonts/inter-latin-variable.woff2': 'app/(pay)/fonts/inter-latin-variable.woff2',
};

const CONFIRMATION = '/order-confirmation/';

/** Edits on top of the verbatim copy. `find` must occur exactly `count` times (default 1). */
export const PATCHES = [
  // Card and bank success go to this site's confirmation page.
  { file: 'src/app/api/card-payment-link/pay/route.js', find: '${baseUrl}/thank-you?', replace: `\${baseUrl}${CONFIRMATION}?` },
  { file: 'src/app/api/chargx/process-card/route.js', find: '${baseUrl}/thank-you?', replace: `\${baseUrl}${CONFIRMATION}?` },
  { file: 'src/app/pay-card/page.js', find: 'href={`/thank-you?', replace: `href={\`${CONFIRMATION}?` },
  { file: 'src/app/pay-bank/page.js', find: 'href={`/thank-you?', replace: `href={\`${CONFIRMATION}?`, count: 2 },
  { file: 'src/app/pay-bank/page.js', find: 'window.location.href = `/thank-you?', replace: `window.location.href = \`${CONFIRMATION}?` },
  // "Back to the catalog" means this site's shop.
  { file: 'src/app/pay-card/page.js', find: 'href="/catalog"', replace: 'href="/shop/"', count: 2 },
  { file: 'src/app/pay-bank/page.js', find: 'href="/catalog"', replace: 'href="/shop/"', count: 2 },
  { file: 'src/app/thank-you/page.js', find: 'href="/catalog"', replace: 'href="/shop/"' },
  // Accounts still live on the catalog only.
  { file: 'src/app/thank-you/page.js', find: 'href={`/account/login?', replace: 'href={`https://catalog.peptidescostarica.net/account/login?' },
  // Payment links in emails and WhatsApp, and ChargX's return address, point
  // at the site the customer is on, not at the catalog. See lib comment.
  {
    file: 'src/lib/publicUrl.js',
    find: "  if (process.env.VERCEL_ENV === 'production') return LIVE_SITE_URL;",
    replace: [
      '  // Website copy (scripts/sync-catalog-checkout.mjs): the company host the',
      '  // request came in on (new.peptidescostarica.net now, peptidescostarica.net',
      '  // after the move), so a customer is never sent to the catalog mid-payment.',
      '  if (requestUrl) {',
      '    try {',
      '      const origin = new URL(requestUrl).origin;',
      '      if (/^https:\\/\\/([a-z0-9-]+\\.)*peptidescostarica\\.net$/i.test(origin)) return origin;',
      '    } catch {',
      '      /* fall through */',
      '    }',
      '  }',
      '',
      "  if (process.env.VERCEL_ENV === 'production') return LIVE_SITE_URL;",
    ].join('\n'),
  },
];

const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 });
const sourceFiles = new Set(git('ls-tree', '-r', '--name-only', REF, 'src', 'public').toString().split('\n').filter(Boolean));
const read = (f) => git('show', `${REF}:${f}`);

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const ext of ['', '.js', '.mjs', '.jsx', '.json', '.css', '/index.js']) {
    if (sourceFiles.has(base + ext)) return base + ext;
  }
  throw new Error(`${from}: cannot resolve import "${spec}"`);
}

const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\2/g;

/** Where a catalog file lands in this site. */
function destination(file) {
  if (ROUTES[file]) return ROUTES[file];
  if (file.startsWith('src/app/')) throw new Error(`${file} is a catalog page/route reached by an import; add it to ROUTES`);
  return `catalog/${file.slice('src/'.length)}`;
}

// Walk the import graph from every route.
const queue = Object.keys(ROUTES);
const files = new Set();
while (queue.length) {
  const file = queue.pop();
  if (files.has(file)) continue;
  files.add(file);
  if (!/\.(m?js|jsx)$/.test(file)) continue;
  for (const m of read(file).toString().matchAll(IMPORT)) {
    const target = resolveImport(file, m[3]);
    if (target) queue.push(target);
  }
}

function transform(file) {
  const raw = read(file);
  if (!/\.(m?js|jsx|css)$/.test(file)) return raw;
  let text = raw.toString();
  if (/\.(m?js|jsx)$/.test(file)) {
    text = text.replace(IMPORT, (all, lead, q, spec) => {
      if (spec.startsWith('@/')) {
        const target = resolveImport(file, spec);
        const dest = destination(target);
        // An import of a page or route file would cross into app/; none do today.
        if (!dest.startsWith('catalog/')) throw new Error(`${file} imports route ${target}`);
        return `${lead}${q}@/catalog/${spec.slice(2)}${q}`;
      }
      if (spec.startsWith('.') && ROUTES[file]) {
        // A route's relative import must land where it still resolves.
        const target = resolveImport(file, spec);
        const rel = path.posix.relative(path.posix.dirname(ROUTES[file]), destination(target));
        return `${lead}${q}${rel.startsWith('.') ? rel : `./${rel}`}${q}`;
      }
      return all;
    });
  }
  for (const p of PATCHES.filter((x) => x.file === file)) {
    const count = text.split(p.find).length - 1;
    if (count !== (p.count ?? 1)) {
      throw new Error(`patch for ${file} expected ${p.count ?? 1} match(es) of ${JSON.stringify(p.find)}, found ${count}: upstream changed, review the patch`);
    }
    text = text.split(p.find).join(p.replace);
  }
  const banner = /\.css$/.test(file)
    ? `/* Copied from the catalog (${file}) by scripts/sync-catalog-checkout.mjs. Do not edit. */\n`
    : `// Copied from the catalog (${file}) by scripts/sync-catalog-checkout.mjs. Do not edit.\n`;
  // 'use client' / 'use server' must stay the first statement.
  const directive = text.match(/^\s*(['"])use (client|server)\1;?[^\n]*\n/);
  if (directive && !/\.css$/.test(file)) return Buffer.from(directive[0] + banner + text.slice(directive[0].length));
  return Buffer.from(banner + text);
}

const outputs = new Map([...files].map((f) => [destination(f), transform(f)]));
for (const p of PATCHES) {
  if (!files.has(p.file)) throw new Error(`patch for ${p.file}, which is no longer copied`);
}

// Files a previous sync wrote that are no longer needed.
const MANIFEST = 'catalog/.synced-files.json';
const previous = fs.existsSync(path.join(ROOT, MANIFEST)) ? JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8')).files : [];
const stale = previous.filter((f) => !outputs.has(f));
const manifest = Buffer.from(`${JSON.stringify({
  note: 'Written by scripts/sync-catalog-checkout.mjs. Every file listed is a copy of catalog code: do not edit.',
  files: [...outputs.keys()].sort(),
}, null, 2)}\n`);
outputs.set(MANIFEST, manifest);

/** Equal, ignoring CRLF vs LF (Git on Windows converts text files on checkout). */
function sameContent(a, b) {
  if (a.equals(b)) return true;
  const text = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');
  return !a.includes(0) && !b.includes(0) && text(a) === text(b);
}

if (CHECK) {
  const drift = [];
  for (const [dest, content] of outputs) {
    const p = path.join(ROOT, dest);
    if (!fs.existsSync(p)) drift.push(`missing  ${dest}`);
    else if (!sameContent(fs.readFileSync(p), content)) drift.push(`differs  ${dest}`);
  }
  for (const s of stale) if (fs.existsSync(path.join(ROOT, s))) drift.push(`stale    ${s}`);
  if (drift.length) {
    console.error(`Checkout copy has drifted from the catalog (${REF}):\n  ${drift.join('\n  ')}\nRun: node scripts/sync-catalog-checkout.mjs`);
    process.exit(1);
  }
  console.log(`Checkout copy matches the catalog (${REF}): ${outputs.size - 1} files.`);
} else {
  for (const s of stale) fs.rmSync(path.join(ROOT, s), { force: true });
  for (const [dest, content] of outputs) {
    const p = path.join(ROOT, dest);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  console.log(`Copied ${outputs.size - 1} files from the catalog (${REF}); removed ${stale.length} stale.`);
}
