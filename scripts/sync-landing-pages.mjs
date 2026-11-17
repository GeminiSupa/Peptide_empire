#!/usr/bin/env node
/**
 * Copies the catalog's Google Ads landing pages into this site.
 *
 *   node scripts/sync-landing-pages.mjs           write the copy
 *   node scripts/sync-landing-pages.mjs --check   exit 1 if the copy has
 *                                                 drifted from the catalog
 *   --ref <git ref>                               default origin/catalog
 *
 * Why these pages are here
 * ------------------------
 * Ted's ads for GHK-Cu and Ipamorelin were pointed at
 * `catalog.peptidescostarica.net/lp/<slug>`. The owner asked (17 Nov 2026) for
 * them to run on the main domain instead, so each one is served here at
 * `peptidescostarica.net/lp/<slug>/` (the rewrites in next.config.mjs). The ad
 * URL is then the page itself, HTTP 200, with no hop — the ads team's rule from
 * 13 Nov 2026, the same reason the old `/lp-<slug>/` addresses are aliases
 * rather than redirects.
 *
 * Why a copy, and not a hand-edited one
 * -------------------------------------
 * Each page is a 600 KB standalone file the catalog owns, rebuilt there
 * whenever the template changes (three times in the week before this). Copied
 * by hand it would silently fall behind. So this script copies it from
 * `origin/catalog` verbatim, applies the handful of edits in PATCHES, and
 * `--check` fails when the two have drifted. Never hand-edit a file it writes:
 * fix it in the catalog (branch `catalog`) and re-run this.
 *
 * What changes in the copy (PATCHES, nothing else)
 * -----------------------------------------------
 *  1. Orders and card payments keep going to the catalog, which is where every
 *     public order already goes from this site (lib/storefront/catalog-origin.mjs,
 *     and the owner's decision that card payments stay on the catalog's
 *     /pay-card). The catalog accepts a browser POST from this host, by design
 *     (its `isTrustedStorefrontRequest`). When this site's own checkout is
 *     switched on (NEXT_PUBLIC_OWN_CHECKOUT=true), these two become relative
 *     again — that is the one thing to change here on that day.
 *  2. A canonical pointing at this site's address, so the copy on the catalog
 *     and the copy here never compete for the same page in Google. Neither is
 *     in a sitemap, but the catalog serves no robots.txt, so both are
 *     crawlable if found.
 *
 * `/api/lp/products` stays relative: this site serves its own
 * (app/api/lp/products/route.js), so a page here reads live prices and stock
 * without the catalog subdomain.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const REF = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'origin/catalog';

/** The ad landing pages copied here, by slug. Each is public/lp/<slug>/index.html. */
export const PAGES = ['ghk-cu-100mg', 'ipamorelin-10mg', 'tesa-compound', 'klow-80mg', 'glow-70mg'];

/** Everything the pages' images live under; copied whole, so new ones follow. */
const ASSET_DIR = 'public/lp-assets';

const CATALOG_ORIGIN = 'https://catalog.peptidescostarica.net';
const SITE_ORIGIN = 'https://peptidescostarica.net';

const VIEWPORT = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';

/**
 * Edits on top of the verbatim copy, per page. Each `find` must occur exactly
 * once, so a change upstream that touches one stops the sync instead of being
 * lost in it.
 */
export function patchesFor(slug) {
  return [
    // Reads as a copy in the browser's view-source, like the banner the
    // checkout sync writes into every file it copies.
    {
      find: '<!DOCTYPE html>',
      replace: `<!DOCTYPE html>\n<!-- Copied from the catalog (public/lp/${slug}/index.html) by scripts/sync-landing-pages.mjs. Do not edit. -->`,
    },
    // This site's address is the original (see the header comment).
    {
      find: VIEWPORT,
      replace: `${VIEWPORT}\n<link rel="canonical" href="${SITE_ORIGIN}/lp/${slug}/">`,
    },
    // The order goes through the catalog's one door, as every order from this
    // site does today, and the card payment continues on the catalog's page.
    {
      find: "fetch('/api/orders/create'",
      replace: `fetch('${CATALOG_ORIGIN}/api/orders/create'`,
    },
    {
      find: "location.href = '/pay-card?order='",
      replace: `location.href = '${CATALOG_ORIGIN}/pay-card?order='`,
    },
    // No TikTok pixel here: this site loads none, its README's rule is to add
    // no pixel without the owner, and these pages are for Google Ads (owner,
    // 17 Nov 2026). The catalog's copies keep theirs.
    {
      find: /<!-- TikTok pixel:[\s\S]*?<\/script>\r?\n/,
      replace: '',
    },
    // This site's routes answer with a trailing slash (trailingSlash in
    // next.config.mjs); asking for that address directly saves a redirect.
    // /api/lp/touch records the visit's source (app/api/lp/touch/route.js);
    // WhatsApp taps go through the synced tracked redirect.
    {
      find: 'fetch("/api/lp/touch",',
      replace: 'fetch("/api/lp/touch/",',
    },
    {
      find: 'return "/api/whatsapp/open?phone="',
      replace: 'return "/api/whatsapp/open/?phone="',
    },
  ];
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 });
const read = (f) => git('show', `${REF}:${f}`);

const assets = git('ls-tree', '-r', '--name-only', REF, ASSET_DIR)
  .toString()
  .split('\n')
  .filter(Boolean);
if (!assets.length) throw new Error(`${REF} has no files under ${ASSET_DIR}`);

/** published path → bytes. */
const outputs = new Map();

for (const slug of PAGES) {
  const file = `public/lp/${slug}/index.html`;
  let html = read(file).toString();
  for (const patch of patchesFor(slug)) {
    const isPattern = patch.find instanceof RegExp;
    const count = isPattern
      ? (html.match(new RegExp(patch.find.source, `${patch.find.flags.replace('g', '')}g`)) || []).length
      : html.split(patch.find).length - 1;
    if (count !== 1) {
      throw new Error(
        `${file}: expected 1 match of ${isPattern ? patch.find : JSON.stringify(patch.find)}, found ${count}: upstream changed, review the patch`,
      );
    }
    html = isPattern ? html.replace(patch.find, () => patch.replace) : html.split(patch.find).join(patch.replace);
  }
  outputs.set(file, Buffer.from(html));
}

for (const asset of assets) outputs.set(asset, read(asset));

// Files a previous sync wrote that are no longer needed.
const MANIFEST = 'data/lp/.synced-files.json';
const manifestPath = path.join(ROOT, MANIFEST);
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files : [];
const stale = previous.filter((f) => !outputs.has(f));
const manifest = Buffer.from(`${JSON.stringify({
  note: 'Written by scripts/sync-landing-pages.mjs. Every file listed is a copy of the catalog\'s ad landing pages: do not edit.',
  files: [...outputs.keys()].sort(),
}, null, 2)}\n`);

/** Equal, ignoring CRLF vs LF (Git on Windows converts text files on checkout). */
function sameContent(a, b) {
  if (a.equals(b)) return true;
  const text = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');
  return !a.includes(0) && !b.includes(0) && text(a) === text(b);
}

if (CHECK) {
  const drift = [];
  for (const [dest, content] of [...outputs, [MANIFEST, manifest]]) {
    const p = path.join(ROOT, dest);
    if (!fs.existsSync(p)) drift.push(`missing  ${dest}`);
    else if (!sameContent(fs.readFileSync(p), content)) drift.push(`differs  ${dest}`);
  }
  for (const s of stale) if (fs.existsSync(path.join(ROOT, s))) drift.push(`stale    ${s}`);
  if (drift.length) {
    console.error(`Landing pages have drifted from the catalog (${REF}):\n  ${drift.join('\n  ')}\nRun: node scripts/sync-landing-pages.mjs`);
    process.exit(1);
  }
  console.log(`Landing pages match the catalog (${REF}): ${outputs.size} files.`);
} else {
  for (const s of stale) fs.rmSync(path.join(ROOT, s), { force: true });
  for (const [dest, content] of [...outputs, [MANIFEST, manifest]]) {
    const p = path.join(ROOT, dest);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  console.log(`Copied ${outputs.size} files from the catalog (${REF}); removed ${stale.length} stale.`);
}
