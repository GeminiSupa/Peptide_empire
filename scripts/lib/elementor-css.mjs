/**
 * Resolve an Elementor page's DESKTOP layout out of its per-post stylesheet.
 *
 * Elementor keeps no layout in the markup. A container div carries only its
 * `data-id`; whether it is a row or a column, how wide its children are, what
 * colour it is painted and how round its corners are all live in
 * `/wp-content/uploads/elementor/css/post-<id>-<host>.css`, as custom
 * properties keyed by that id:
 *
 *   .elementor-12201 .elementor-element.elementor-element-334ec0f{
 *     --display:flex; --flex-direction:row; --align-items:stretch; ... }
 *
 * That is why the first harvest lost every column, card and section background
 * on the site: it read the markup, where none of this exists. This module reads
 * the other half.
 */

/**
 * Flatten the stylesheet to the rules that apply at DESKTOP width.
 *
 * Elementor writes three layers and they are not interchangeable:
 *
 *   unconditional            — properties shared by every breakpoint
 *   @media(min-width:768px)  — the DESKTOP layout, and the only place column
 *                              widths (`--width:55%`) are ever declared
 *   @media(max-width:1024px) — tablet overrides
 *   @media(max-width:767px)  — phone overrides
 *
 * So min-width blocks must be INLINED and max-width blocks DROPPED. Dropping
 * both (the obvious reading of "ignore media queries") silently loses every
 * column width in the file and lays the whole site out in one column; keeping
 * both leaves each container holding its phone layout, with the same result.
 * The responsive half is re-expressed with Tailwind breakpoints in the
 * renderer rather than carried through the data.
 */
function desktopOnly(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;

  for (;;) {
    const at = src.indexOf('@media', i);
    if (at === -1) {
      out += src.slice(i);
      return out;
    }
    out += src.slice(i, at);

    const open = src.indexOf('{', at);
    if (open === -1) return out;

    // Walk braces to find the matching close, so nested rules cannot end it early.
    let depth = 0;
    let j = open;
    for (; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const query = src.slice(at, open);
    // Inline desktop-up blocks; skip anything scoped to a smaller screen.
    if (/min-width/.test(query) && !/max-width/.test(query)) out += src.slice(open + 1, j);

    i = j + 1;
  }
}

/** The declarations this project reads. Everything else is ignored. */
const WANTED = new Set([
  '--display',
  '--flex-direction',
  '--justify-content',
  '--align-items',
  '--gap',
  '--width',
  '--content-width',
  '--min-height',
  '--e-con-grid-template-columns',
  '--padding-top',
  '--padding-bottom',
  '--padding-left',
  '--padding-right',
  '--margin-top',
  '--margin-bottom',
  '--border-radius',
  '--border-color',
  '--border-top-width',
  '--overlay-opacity',
  '--align-self',
  'background-color',
  'background-image',
  'border-radius',
  // Legacy `elementor-section` / `elementor-column` pages predate the custom
  // properties above and style themselves with ordinary declarations.
  'width',
  'padding',
  'margin',
  'text-align',
  'color',
  'fill',
  'text-transform',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'font-family',
  'box-shadow',
]);

/**
 * Inner nodes whose styling belongs to the widget that contains them.
 *
 * A heading widget's colour is declared on `.elementor-heading-title`, not on
 * the widget box, so it is folded onto the widget itself (empty prefix). The
 * others name a distinct part and keep one, so a card's title colour cannot be
 * mistaken for its description's.
 */
const PART = {
  'elementor-heading-title': '',
  'elementor-button': 'btn-',
  'elementor-icon-box-title': 'boxtitle-',
  'elementor-icon-box-description': 'boxdesc-',
  'elementor-icon-list-text': 'listtext-',
  'elementor-icon-list-icon': 'icon-',
  'elementor-icon': 'icon-',
};

// Two optional segments in the middle, because Elementor writes the same
// property at different depths depending on the widget:
//   …-72ed4f7 .elementor-icon-list-item > .elementor-icon-list-text   (typography)
//   …-72ed4f7 .elementor-icon-list-icon svg                           (glyph colour)
// Allowing both is what lets the hero's list keep its 20px bold navy labels and
// its red check marks; requiring the part to sit directly under the element
// matched neither.
const INNER = new RegExp(
  '^\\.elementor-\\d+\\s+\\.elementor-element\\.elementor-element-([\\w-]+)' +
    '(?:\\s*>\\s*\\.elementor-widget-container)?' +
    '(?:\\s+\\.elementor-icon-list-item\\s*>)?' +
    `\\s*\\.(${Object.keys(PART).join('|')})(?:\\s+(?:i|svg))?$`,
);

/**
 * The widget's own box.
 *
 * `> .elementor-widget-container` is where a widget gets a fill of its own —
 * which on this site means a badge: the red "PEPTIDES COSTA RICA" pill over the
 * hero headline and the "BULK OFFER" pill on the navy panel are both a heading
 * widget whose container is painted, padded and rounded. Read as the heading's
 * own colour instead, they came out as white text on a white background and
 * simply vanished.
 */
const BOX =
  /^\.elementor-\d+\s+\.elementor-element\.elementor-element-([\w-]+)\s*>\s*\.elementor-widget-container$/;

/**
 * @param {string} css      one page's stylesheet (or several, concatenated)
 * @param {object} globals  `--e-global-color-*` values, for var() resolution
 * @returns {Map<string, Record<string,string>>} data-id -> declarations
 */
export function parseElementorCss(css, globals = {}) {
  const byId = new Map();
  const body = desktopOnly(css);

  const DECL = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = DECL.exec(body))) {
    const decls = match[2];
    if (!decls.trim()) continue;

    for (const sel of match[1].split(',')) {
      // Only the element's own resting rule. Elementor also emits `:hover`,
      // `::before` and descendant selectors for the same id, which describe
      // states and children rather than the container itself.
      //
      // `:not(.elementor-motion-effects-element-type-background)` is the one
      // exception that must be accepted: it is how Elementor paints a container
      // that has no parallax layer — which is every ordinary section — and it
      // is the ONLY place background-color is ever declared.
      const s = sel.trim();
      const m = /^\.elementor-\d+\s+\.elementor-element\.elementor-element-([\w-]+)(?::not\(\.elementor-motion-effects-element-type-background\))?$/.exec(
        s,
      );

      // A widget's own paint is often NOT on the widget element: Elementor
      // styles the inner node that carries the text. Without this the harvest
      // could not tell a navy "Call To Order" from an orange "Read The
      // Article", and every heading inside the navy bands stayed navy-on-navy.
      const inner = !m && INNER.exec(s);
      const box = !m && !inner && BOX.exec(s);

      if (!m && !inner && !box) continue;

      const id = (m ?? inner ?? box)[1];
      const prefix = box ? 'box-' : inner ? (PART[inner[2]] ?? '') : '';
      const target = byId.get(id) ?? {};
      byId.set(id, target);

      for (const decl of decls.split(';')) {
        const c = decl.indexOf(':');
        if (c === -1) continue;
        const prop = decl.slice(0, c).trim();
        if (!WANTED.has(prop)) continue;
        // The widget's own rule always wins over an inner one.
        if (prefix === '' && inner && target[prop] !== undefined) continue;
        target[prefix + prop] = resolveVars(decl.slice(c + 1).trim(), globals);
      }
    }
  }

  return byId;
}

/** Replace `var( --e-global-color-x )` with the hex the kit defines for it. */
function resolveVars(value, globals) {
  return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, name) => globals[name] ?? whole);
}

/** Pull the `--e-global-color-*` / typography map out of the kit stylesheet. */
export function parseGlobals(css) {
  const out = {};
  const kit = /\.elementor-kit-\d+\{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (!kit) return out;
  for (const decl of kit[1].split(';')) {
    const c = decl.indexOf(':');
    if (c === -1) continue;
    out[decl.slice(0, c).trim()] = decl.slice(c + 1).trim();
  }
  return out;
}
