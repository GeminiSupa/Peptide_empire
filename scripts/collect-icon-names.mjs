/**
 * Collects every Material Symbols ligature the site draws, and writes
 * lib/site/icon-names.mjs.
 *
 * Why this exists: the design draws icons as Material Symbols ligatures
 * (`<span class="ms">search</span>`). Asking fonts.googleapis.com for the family
 * with open axis ranges returns the whole variable font — every one of ~3,600
 * icons at every weight and fill: a 3 MB woff2 on a page whose own HTML, CSS and
 * JS together are under 300 KB. It was by far the largest download on the site,
 * and with `display=block` it held every icon invisible until it arrived.
 *
 * site.css only ever asks for two instances — `.ms` (opsz 24, wght 450, FILL 0,
 * GRAD 0) and `.ms.f` (wght 500, FILL 1) — so opsz and GRAD never needed to vary
 * at all, and `icon_names=` makes Google return only the glyphs we draw.
 *
 * Run `node scripts/collect-icon-names.mjs` after adding an icon; `--check`
 * fails when the committed list has drifted (tests/icon-names.test.mjs).
 *
 * Icon names reach a page from five places, all of them source:
 *   1. a literal ligature in JSX    <span className="ms">search</span>
 *   2. the `Ms` component's prop    <Ms name="search" />
 *   3. an `icon:` field             { slug: '...', icon: 'monitoring' }
 *   4. a named array of icons       const ICONS = ['monitoring', 'healing']
 *   5. the harvested page trees in data/site/pages/*.json, which carry the
 *      design's own markup: ["span", {"class": "ms"}, "inventory_2"]
 * Category icons live in lib/site/links.mjs, not the database, so this is the
 * whole set — no icon is chosen at runtime.
 *
 * Which classes count as icon classes is read from the stylesheets rather than
 * listed here: any rule that sets the Material Symbols family contributes its
 * class. Today that is `.ms`, `.ms.f` and `.ctile-go` — `.ctile-go` is why this
 * is derived and not hardcoded, since it draws a ligature without being `.ms`.
 *
 * A missing name is the costly mistake — it shows the visitor the raw word
 * ("inventory_2") where an icon belongs — so the scan is deliberately generous.
 * Icons also sit in plain tuples that no pattern can recognise by shape, such as
 * `['inventory_2', 'Product Information', ...]` in home-page.js and
 * `['affiliate-program', 'Affiliate Program', 'handshake']` in site-header.js.
 * Rather than chase every shape, any file that draws icons also has every bare
 * word swept out of it, and those extras are kept only when data/material-symbols.txt
 * says they are real icon names. The four sources above are trusted without that
 * check, so a brand-new icon still works if that vendored list is out of date.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_DIRS = ['app', 'components', 'lib'];
const DATA_DIR = 'data';
const OUTPUT = join(ROOT, 'lib/site/icon-names.mjs');

/** A ligature: lowercase letters, digits and underscores, as Google names them. */
const LIGATURE = '[a-z][a-z0-9_]*';
const QUOTE = '["\'`]';

/**
 * The class names whose CSS sets the Material Symbols family, read from
 * app/*.css. A new icon class is picked up without touching this script.
 */
export function iconClasses() {
  const classes = new Set();
  const styles = join(ROOT, 'app');
  for (const file of readdirSync(styles).filter((name) => name.endsWith('.css'))) {
    const css = readFileSync(join(styles, file), 'utf8');
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/Material Symbols Rounded/.test(body)) continue;
      for (const selector of selectors.split(',')) {
        // '.pcr-site .ms.f' -> 'ms'; '.pcr-site .ctile-go' -> 'ctile-go'.
        const name = selector.trim().split(/\s+/).pop().match(/\.([A-Za-z0-9_-]+)/)?.[1];
        if (name) classes.add(name);
      }
    }
  }
  return [...classes].sort();
}

/** Each captures the ligature in group 1. */
const PATTERNS = [
  // <Ms name="search" />
  new RegExp(`<Ms\\b[^>]*\\bname=${QUOTE}(${LIGATURE})${QUOTE}`, 'g'),
  // { icon: 'monitoring' }
  new RegExp(`\\bicon:\\s*${QUOTE}(${LIGATURE})${QUOTE}`, 'g'),
  // <span className="ms ...">search</span> — the span's own text is the ligature.
  ...iconClasses().map(
    (name) => new RegExp(`className=${QUOTE}${name}\\b[^"'\`]*${QUOTE}[^>]*>\\s*(${LIGATURE})\\s*<`, 'g'),
  ),
];

/** const ICONS = ['monitoring', 'healing'], and `ICONS[i] || 'science'`. */
const ICON_ARRAY = /\b\w*ICONS?\b\s*=\s*\[([^\]]*)\]/g;
const ICON_FALLBACK = new RegExp(`\\b\\w*ICONS?\\b\\s*\\[[^\\]]*\\]\\s*\\|\\|\\s*${QUOTE}(${LIGATURE})${QUOTE}`, 'g');
const QUOTED = new RegExp(`${QUOTE}(${LIGATURE})${QUOTE}`, 'g');
/** Every bare word in a file that draws icons; filtered against the catalog below. */
const SWEPT = new RegExp(`${QUOTE}(${LIGATURE})${QUOTE}`, 'g');

/** The names Google publishes, so a sweep can tell an icon from an ordinary string. */
export function iconCatalog() {
  const text = readFileSync(join(ROOT, DATA_DIR, 'material-symbols.txt'), 'utf8');
  return new Set(text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')));
}

function filesUnder(dir, extensions, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesUnder(path, extensions, found);
    else if (extensions.test(entry)) found.push(path);
  }
  return found;
}

/**
 * Ligatures inside a harvested page tree, which stores markup as nested arrays:
 * ["span", {"class": "ms"}, "inventory_2"]. These pages (contact, the policies,
 * about…) are most of the site's icons and none of them appear in JSX.
 */
function ligaturesInTree(node, classes, out) {
  if (!Array.isArray(node)) return;
  const [, attrs, ...children] = node;
  const className = attrs && typeof attrs === 'object' ? attrs.class : null;
  if (typeof className === 'string') {
    const names = className.split(/\s+/);
    if (names.some((name) => classes.includes(name))) {
      for (const child of children) {
        if (typeof child === 'string' && new RegExp(`^${LIGATURE}$`).test(child)) out.add(child);
      }
    }
  }
  for (const child of node) ligaturesInTree(child, classes, out);
}

/** Every ligature in the source tree, sorted, with the file each came from. */
export function collectIconNames() {
  const classes = iconClasses();
  const catalog = iconCatalog();
  const sources = new Map();
  const drawsIcons = new RegExp(`className=${QUOTE}(?:${classes.join('|')})\\b`);

  for (const dir of SOURCE_DIRS) {
    for (const file of filesUnder(join(ROOT, dir), /\.(js|mjs)$/)) {
      const code = readFileSync(file, 'utf8');
      const where = relative(ROOT, file).replace(/\\/g, '/');
      const add = (name) => { if (!sources.has(name)) sources.set(name, where); };

      for (const pattern of PATTERNS) {
        for (const match of code.matchAll(pattern)) add(match[1]);
      }
      for (const [, body] of code.matchAll(ICON_ARRAY)) {
        for (const match of body.matchAll(QUOTED)) add(match[1]);
      }
      for (const match of code.matchAll(ICON_FALLBACK)) add(match[1]);

      // A file that draws icons may also hold them in a shape no pattern knows,
      // such as ['affiliate-program', 'Affiliate Program', 'handshake'] in
      // site-header.js. Sweep it and keep what the catalog recognises.
      if (drawsIcons.test(code)) {
        for (const match of code.matchAll(SWEPT)) if (catalog.has(match[1])) add(match[1]);
      }
    }
  }

  for (const file of filesUnder(join(ROOT, DATA_DIR), /\.json$/)) {
    const where = relative(ROOT, file).replace(/\\/g, '/');
    let tree;
    try { tree = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    const found = new Set();
    ligaturesInTree(tree, classes, found);
    for (const name of found) if (!sources.has(name)) sources.set(name, where);
  }

  return { names: [...sources.keys()].sort(), sources };
}

const HEADER = `/**
 * Every Material Symbols ligature the site draws — GENERATED, do not edit.
 *
 * Written by scripts/collect-icon-names.mjs; that script's \`--check\` and
 * tests/icon-names.test.mjs fail when it drifts. Add an icon in a component,
 * then re-run the script.
 *
 * This list is what keeps the icon font a few KB instead of the 3 MB
 * whole-family download: \`icon_names=\` asks for these glyphs only.
 */
`;

export function iconNamesModule(names) {
  const list = names.map((name) => `  '${name}',`).join('\n');
  return `${HEADER}
export const ICON_NAMES = [
${list}
];

/**
 * The stylesheet URL for exactly those icons.
 *
 * The axes are narrowed to what app/site.css actually asks for: \`.ms\` draws at
 * wght 450 / FILL 0 and \`.ms.f\` at wght 500 / FILL 1, both at opsz 24, GRAD 0.
 * So wght and FILL stay variable across that span and opsz and GRAD are pinned —
 * the previous URL left all four open (20..48, 400..600, 0..1, 0).
 *
 * The list is sorted and both shells call this, so every page asks for the
 * identical URL and the font is fetched once for the whole site.
 */
export function materialSymbolsHref() {
  const family = 'Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,450..500,0..1,0';
  return \`https://fonts.googleapis.com/css2?family=\${family}&icon_names=\${ICON_NAMES.join(',')}&display=block\`;
}
`;
}

// Only when run as a command: tests/icon-names.test.mjs imports the functions
// above and must not rewrite the file it is checking.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { names, sources } = collectIconNames();
  const next = iconNamesModule(names);
  const current = (() => {
    try { return readFileSync(OUTPUT, 'utf8'); } catch { return null; }
  })();

  if (process.argv.includes('--check')) {
    if (current !== next) {
      console.error('lib/site/icon-names.mjs is out of date — run: node scripts/collect-icon-names.mjs');
      process.exit(1);
    }
    console.log(`icon names up to date (${names.length} icons)`);
  } else {
    writeFileSync(OUTPUT, next);
    console.log(`Wrote lib/site/icon-names.mjs — ${names.length} icons`);
    if (process.argv.includes('--verbose')) {
      for (const name of names) console.log(`  ${name.padEnd(22)} ${sources.get(name)}`);
    }
  }
}
