import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectIconNames, iconCatalog, iconClasses, iconNamesModule } from '../scripts/collect-icon-names.mjs';
import { ICON_NAMES, materialSymbolsHref } from '../lib/site/icon-names.mjs';

const css = (file) => fs.readFileSync(new URL(`../app/${file}`, import.meta.url), 'utf8');

test('the committed icon list matches the source tree', () => {
  const { names } = collectIconNames();
  const expected = iconNamesModule(names);
  const actual = fs.readFileSync(new URL('../lib/site/icon-names.mjs', import.meta.url), 'utf8');
  assert.equal(
    actual,
    expected,
    'lib/site/icon-names.mjs is stale — run: node scripts/collect-icon-names.mjs',
  );
});

test('every class that draws the icon font is scanned for ligatures', () => {
  // `.ctile-go` draws a ligature without being `.ms`, which is why the scan
  // reads its class list from the stylesheets instead of hardcoding `ms`.
  const classes = iconClasses();
  assert.ok(classes.includes('ms'), 'the .ms class must be found');
  assert.ok(classes.includes('ctile-go'), 'the .ctile-go class must be found');
});

test('the icons the shells reference are all in the list', () => {
  // A ligature that is rendered but missing from the list renders as the raw
  // word ("shopping_bag") in the page, so this is the check that matters.
  assert.ok(ICON_NAMES.includes('arrow_forward'), 'the category tile arrow');
  assert.ok(ICON_NAMES.includes('shopping_bag'), 'the header cart');
  assert.ok(ICON_NAMES.includes('search'), 'the header search');
  assert.ok(ICON_NAMES.length > 50 && ICON_NAMES.length < 400, ICON_NAMES.length);
  assert.deepEqual(ICON_NAMES, [...ICON_NAMES].sort(), 'kept sorted, so the URL is stable');
  assert.equal(new Set(ICON_NAMES).size, ICON_NAMES.length, 'no duplicates');
});

test('the icons held in plain tuples and harvested pages are not missed', () => {
  // Each of these was dropped by an earlier, stricter scan and only showed up
  // when the rendered pages were compared against the list:
  assert.ok(ICON_NAMES.includes('handshake'), "site-header.js's ['affiliate-program', 'Affiliate Program', 'handshake']");
  assert.ok(ICON_NAMES.includes('inventory_2'), "home-page.js's ['inventory_2', 'Product Information', '…']");
  assert.ok(ICON_NAMES.includes('assignment_return'), 'data/site/pages/contact-costa-rica.json');
  assert.ok(ICON_NAMES.includes('local_pharmacy'), 'data/site/pages/affiliate-program.json');
});

test('every name is a real Material Symbol', () => {
  // Unknown names are ignored by fonts.googleapis.com rather than rejected, so
  // nothing breaks either way — this just keeps the generated list meaningful.
  const catalog = iconCatalog();
  assert.ok(catalog.size > 3000, `the vendored catalog looks truncated: ${catalog.size}`);
  const unknown = ICON_NAMES.filter((name) => !catalog.has(name));
  assert.deepEqual(unknown, [], `not Material Symbols: ${unknown.join(', ')}`);
});

test('the font URL asks only for the glyphs and axes the CSS uses', () => {
  const href = materialSymbolsHref();
  // Pinned opsz and GRAD, and a wght/FILL span covering `.ms` (450/0) and
  // `.ms.f` (500/1). Open ranges here returned the whole 3 MB variable font.
  assert.match(href, /@24,450\.\.500,0\.\.1,0&/);
  assert.match(href, /[?&]icon_names=/);
  assert.ok(!/@20\.\.48/.test(href), 'the opsz range must stay pinned');
  for (const name of ICON_NAMES) assert.ok(href.includes(name), name);
});

test('both instances the stylesheets draw are inside the requested range', () => {
  const site = css('site.css');
  const storefront = css('storefront.css');
  for (const sheet of [site, storefront]) {
    assert.match(sheet, /\.ms\{[^}]*"wght" 450/, 'unfilled icons draw at wght 450');
    assert.match(sheet, /\.ms\.f\{[^}]*"wght" 500/, 'filled icons draw at wght 500');
    assert.match(sheet, /\.ms\{[^}]*"opsz" 24/, 'at optical size 24');
  }
});

test('nothing can uppercase an icon out of existence', () => {
  // A ligature is matched on the text as rendered, so an inherited
  // text-transform turns `bolt` into `BOLT` and the glyph never appears —
  // which is what the "Volume pricing" badge was doing.
  const base = css('site-base.css');
  assert.match(base, /\.pcr-site \.ms,\s*\n\.pcr-site \.ctile-go \{ text-transform: none; \}/);
  assert.match(css('site.css'), /\.deal \.dk\{[^}]*text-transform:uppercase/, 'the badge that exposed it');
});

test('no shell loads the whole Material Symbols family any more', () => {
  const shells = ['../components/site/site-shell.js', '../components/storefront/storefront.js'];
  for (const shell of shells) {
    const code = fs.readFileSync(new URL(shell, import.meta.url), 'utf8');
    assert.ok(
      !/fonts\.googleapis\.com\/css2\?family=Material/.test(code),
      `${shell} must build the URL from lib/site/icon-names.mjs, not inline it`,
    );
    assert.match(code, /materialSymbolsHref\(\)/, shell);
  }
});
