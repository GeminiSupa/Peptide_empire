/**
 * Walk an Elementor container tree into nested layout-bearing blocks.
 *
 * Elementor's container tree IS the page's layout, and none of it is in the
 * markup: a container div carries a `data-id` and nothing else. The
 * arrangement — row or column, how wide each column is, what the section is
 * painted, which boxes are cards — is declared in the per-post stylesheet
 * against that id. See ./elementor-css.mjs for that half.
 *
 * The first harvest read only the markup and swept `$('.elementor-widget')`
 * FLAT, so every column, card, section background and centred heading on the
 * site was discarded before the renderer ever saw it. That one line is the
 * cause behind most of the visual gap against the live site: two-column
 * sections stacked into one, cards flattened into loose headings and
 * paragraphs, navy bands turned white, centred text went left.
 */

const ORIGIN = 'https://peptidescostarica.net';
const UA = 'peptidescostarica-rebuild-harvest';

import { parseElementorCss, parseGlobals } from './elementor-css.mjs';

const rel = (v) => (v ? v.replace(/^https?:\/\/[^/]+/, '') : null);

/** Elementor's kit stylesheet, fetched once and shared by every page. */
let kitGlobals = null;
export async function globals() {
  if (kitGlobals) return kitGlobals;
  try {
    const res = await fetch(
      `${ORIGIN}/wp-content/uploads/elementor/css/post-14-peptidescostarica.net.css`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) },
    );
    kitGlobals = res.ok ? parseGlobals(await res.text()) : {};
  } catch {
    kitGlobals = {};
  }
  return kitGlobals;
}

/**
 * One page's `data-id -> layout` map.
 *
 * Only real answers are cached. An empty map means "this page genuinely has no
 * per-element layout", which is rare; a fetch that failed is never cached,
 * because with no stylesheet every container falls back to a plain column and
 * the page silently loses its design.
 */
const layoutCache = new Map();

/**
 * Pages whose stylesheet could not be fetched, so their layout is missing.
 * Cleared between groups so each group reports only its own failures.
 */
export const layoutFailures = [];
export const clearLayoutFailures = () => layoutFailures.splice(0, layoutFailures.length);

export async function layoutFor(postId, route = null, attempt = 1) {
  if (layoutCache.has(postId)) return layoutCache.get(postId);
  const g = await globals();
  const cssUrl = `${ORIGIN}/wp-content/uploads/elementor/css/post-${postId}-peptidescostarica.net.css`;

  try {
    let res = await fetch(cssUrl, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });

    /**
     * A 404 does NOT mean the page has no layout.
     *
     * Elementor writes these files LAZILY — the stylesheet for a page appears
     * only once that page has been rendered, and is dropped again when caches
     * are cleared. So a page nobody has visited recently 404s here, and reading
     * that as "no per-element layout" flattened it to a single column: 120 pages
     * had every column, card and section background silently removed on that
     * basis alone.
     *
     * Requesting the page is what makes WordPress generate the file, which is
     * exactly what a browser does on the first visit.
     */
    if (res.status === 404 && route) {
      await fetch(ORIGIN + route, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
      await new Promise((r) => setTimeout(r, 1200));
      res = await fetch(cssUrl, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
    }

    // Still gone after the page has been rendered: this page really has no
    // per-element layout. That is an answer, and it is cached.
    if (res.status === 404) {
      layoutCache.set(postId, new Map());
      return layoutCache.get(postId);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const map = parseElementorCss(await res.text(), g);
    layoutCache.set(postId, map);
    return map;
  } catch (err) {
    // Retry, and NEVER cache a failure.
    //
    // Swallowing this silently is worse than it sounds: with no stylesheet every
    // container falls back to a plain column, so one dropped connection quietly
    // republishes a page with its columns, card backgrounds and navy bands gone
    // — which is exactly what happened to /about/. It looks like a successful
    // harvest, so nothing catches it.
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
      return layoutFor(postId, route, attempt + 1);
    }
    layoutFailures.push(`post-${postId}: ${err.message}`);
    return new Map();
  }
}

/**
 * Merge the layout out of several stylesheets — the ones a rendered page links.
 *
 * A WooCommerce product page has NO stylesheet of its own: the page is
 * assembled by an Elementor product TEMPLATE, and the container layout is
 * declared against the template's post id, not the product's. Looking it up by
 * `wp.id` therefore found nothing and rendered all 66 product pages as one flat
 * column. Reading the `post-*.css` links out of the page is what a browser
 * does, and it needs no knowledge of which template is in play.
 */
export async function layoutFromUrls(urls) {
  const g = await globals();
  const merged = new Map();

  for (const url of urls) {
    let css = null;
    for (let attempt = 1; attempt <= 3 && css === null; attempt += 1) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        css = await res.text();
      } catch (err) {
        if (attempt === 3) layoutFailures.push(`${url}: ${err.message}`);
        else await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
      }
    }
    if (css === null) continue;

    for (const [id, props] of parseElementorCss(css, g)) {
      merged.set(id, { ...(merged.get(id) ?? {}), ...props });
    }
  }

  return merged;
}

const px = (v) => {
  if (!v) return null;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return null;
  return /em$/.test(v) ? Math.round(n * 16) : Math.round(n);
};

/** `10px 10px 10px 10px` -> 10. Elementor writes all four corners; keep one. */
const radius = (v) => (v ? px(v.split(/\s+/)[0]) : null);

/**
 * A CSS `padding` shorthand -> [top, right, bottom, left].
 *
 * Legacy `elementor-section` / `elementor-column` pages predate the
 * `--padding-*` custom properties and declare ordinary `padding` instead. Only
 * the custom properties were being read, so those pages came through with no
 * padding at all — the home page kept 8 of 18 section paddings, the city pages
 * 37%, while the container-era product pages kept ~90%. That difference is the
 * spacing being wrong, not a design choice.
 */
const shorthandPad = (v) => {
  if (!v) return null;
  const parts = String(v).trim().split(/\s+/).map(px);
  if (!parts.length || parts.some((n) => n === null)) return null;
  const [a, b, c, d] = parts;
  if (parts.length === 1) return [a, a, a, a];
  if (parts.length === 2) return [a, b, a, b];
  if (parts.length === 3) return [a, b, c, b];
  return [a, b, c, d];
};

/**
 * Turn one container's raw declarations into the small layout record the
 * renderer understands. Anything absent stays absent rather than being
 * defaulted here, so the renderer owns the fallbacks in one place.
 */
export function containerLayout(props = {}, cls = '', kind = 'container') {
  const out = {};

  // Elementor omits --flex-direction when the container is a column, because
  // column is its own default. Treating "missing" as unknown and defaulting to
  // row would lay every stacked section out sideways.
  //
  // A legacy `section` is always a row: its whole purpose is to lay `column`
  // children side by side, which is what `.elementor-container{display:flex}`
  // does for it. Those pages carry no --flex-direction at all.
  out.dir = kind === 'section' ? 'row' : props['--flex-direction'] === 'row' ? 'row' : 'column';

  // Elementor grids are not flex rows. "How We Operate" is
  // `--display:grid; --e-con-grid-template-columns:repeat(3, 1fr)`. Reading
  // only flex-direction stored that container as a column, so the six cards
  // stacked instead of sitting three across.
  const cols = /repeat\(\s*(\d+)\s*,/.exec(props['--e-con-grid-template-columns'] || '');
  if (props['--display'] === 'grid' && cols) out.cols = Number(cols[1]);

  // Percentages are the only widths worth carrying: they are what makes a
  // 55/45 split. A pixel width would not survive a change of container size.
  const w = props['--width'] || props.width;
  if (w && w.endsWith('%')) out.width = parseFloat(w);

  // Legacy columns declare their share as a class rather than a property.
  // `elementor-col-33` is Elementor's rounding of a third, not 33%.
  const col = /\belementor-col-(\d+)\b/.exec(cls);
  if (!out.width && col) out.width = Number(col[1]) === 33 ? 33.333 : Number(col[1]);

  const bg = props['background-color'];
  if (bg && !/^rgba\(0, ?0, ?0, ?0\)$|^transparent$/i.test(bg)) out.bg = bg;

  const bgi = props['background-image'];
  const url = bgi && /url\(\s*["']?([^"')]+)/.exec(bgi);
  if (url) out.bgImage = rel(url[1]);

  const r = radius(props['--border-radius']);
  if (r) out.radius = r;

  if (props['--border-color'] && px(props['--border-top-width'])) out.border = props['--border-color'];

  const gap = px((props['--gap'] || '').split(/\s+/)[0]);
  if (gap !== null) out.gap = gap;

  if (props['--justify-content']) out.justify = props['--justify-content'];
  if (props['--align-items']) out.items = props['--align-items'];
  if (props['--content-width']) out.contentWidth = px(props['--content-width']);
  if (px(props['--min-height'])) out.minHeight = px(props['--min-height']);

  const pad = ['--padding-top', '--padding-right', '--padding-bottom', '--padding-left'].map((k) =>
    px(props[k]),
  );
  if (pad.some((n) => n)) out.pad = pad.map((n) => n ?? 0);
  else {
    // Legacy sections and columns: an ordinary `padding` declaration.
    const legacy = shorthandPad(props.padding);
    if (legacy && legacy.some((n) => n)) out.pad = legacy;
  }

  const mt = px(props['--margin-top']);
  if (mt) out.marginTop = mt;

  // Flex `order` is how Elementor pulls a widget above its siblings without
  // moving it in the markup. The Tico Times logo is `order: -99999`, so it
  // sits above its caption even though it follows that caption in the DOM.
  // Dropping the property left the logo under the button.
  // Elementor writes this as `--order:-99999`, not `order`. Its frontend CSS
  // turns the custom property into the real flex order.
  const ord = props.order || props['--order'];
  if (ord && ord !== '0') out.order = Number(ord);

  const hide = hideClass(cls);
  if (hide) out.hide = hide;
  else if (props.display === 'none') out.hide = 'hidden';

  // `e-con-boxed` is Elementor's "constrain my children to the content width"
  // flag; `e-con-full` spans the whole band. That distinction is what lets a
  // navy section run edge to edge while its text stays in the middle column.
  // `elementor-section-boxed` is the legacy spelling of the same thing.
  out.boxed = cls.includes('e-con-boxed') || cls.includes('elementor-section-boxed');

  return out;
}

/**
 * Elementor's responsive visibility classes, as a Tailwind class string.
 *
 * `elementor-hidden-desktop` (and the tablet / mobile twins) are not in the
 * per-post stylesheet this module reads — they live in Elementor's frontend
 * CSS. A container carrying all three is removed at every breakpoint; the
 * home page's old "Shop By Category" block is one of those, and rendering it
 * put a product wall on the clone that the live site never shows.
 */
function hideClass(cls) {
  const mobile = cls.includes('elementor-hidden-mobile');
  const tablet = cls.includes('elementor-hidden-tablet');
  const desktop = cls.includes('elementor-hidden-desktop');
  if (!mobile && !tablet && !desktop) return null;
  if (mobile && tablet && desktop) return 'hidden';
  return [
    mobile ? 'max-md:hidden' : '',
    tablet ? 'md:max-lg:hidden' : '',
    desktop ? 'lg:hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Elementor's two generations of layout node, both of which this site uses. */
const CONTAINER_TYPES = new Set(['container', 'section', 'column', 'inner-section']);

/**
 * Walk the container tree, emitting one nested `group` per container and leaf
 * blocks for the widgets inside it.
 *
 * @param {Function} widgetToBlock  the existing per-widget extractor
 */
export function walkTree($, node, tr, css, widgetToBlock) {
  const out = [];

  for (const el of $(node).children().toArray()) {
    const $el = $(el);
    const cls = $el.attr('class') || '';

    // `data-element_type`, never the class list, decides what a node is.
    //
    // Matching on `class.includes('elementor-element')` looks equivalent and is
    // not: the wrapper Elementor puts inside every legacy column is
    // `elementor-widget-wrap elementor-element-populated`, whose class CONTAINS
    // that substring while the node itself is plumbing. Treating it as a widget
    // made widgetToBlock return null and silently discarded the entire column —
    // which is how six whole sections of the home page went missing.
    const kind = $el.attr('data-element_type');

    if (!kind) {
      // Plumbing (`.e-con-inner`, `.elementor-container`, `.elementor-widget-wrap`)
      // or a plugin's own markup. Descend so nothing underneath is lost.
      out.push(...walkTree($, el, tr, css, widgetToBlock));
      continue;
    }

    if (CONTAINER_TYPES.has(kind)) {
      const children = walkTree($, el, tr, css, widgetToBlock);
      if (!children.length) continue;

      const layout = containerLayout(css.get($el.attr('data-id')), cls, kind);

      // A plain wrapper around a single child is a level of nesting the reader
      // can never see. Collapse it — but only when it paints nothing and is not
      // itself a column in a row.
      const paints =
        layout.bg || layout.bgImage || layout.radius || layout.border || layout.minHeight;
      if (children.length === 1 && !paints && layout.dir !== 'row' && !layout.width) {
        out.push(children[0]);
        continue;
      }

      out.push({ type: 'group', ...layout, children });
      continue;
    }

    // A widget. Elementor never nests widgets inside widgets, so this is a leaf.
    const block = widgetToBlock($, el, tr);
    if (!block) continue;

    // Centring and colour are declared per widget, not per container: the
    // "We Do Things Differently" heading is centred by a rule on its own id,
    // and the headings inside a navy band are white by the same means. Without
    // this every heading on the site rendered left-aligned and navy.
    const own = css.get($el.attr('data-id')) ?? {};
    const align = own['text-align'];
    /**
     * The widget's own type scale.
     *
     * Elementor gives each heading its size individually, and this site relies
     * on that: an <h2> is 44.2px as a section title, 24.88px as a card title
     * and 22px in a small card. Rendered from one <h2> rule they all came out
     * the same size, which is most of why the clone read as a different design
     * even where the layout matched.
     */
    const typography = (b, prefix = '') => {
      const size = own[`${prefix}font-size`];
      const weight = own[`${prefix}font-weight`];
      const height = own[`${prefix}line-height`];
      const spacing = own[`${prefix}letter-spacing`];
      const family = own[`${prefix}font-family`];
      // `font`, not `type` — `b.type` is the BLOCK's type ('heading'), and
      // overwriting it would make the renderer unable to find a component.
      const font = {};
      if (size) font.size = size;
      if (weight) font.weight = weight;
      if (height) font.height = height;
      if (spacing && spacing !== 'normal') font.spacing = spacing;
      // Only the family NAME; the fallback stack is the stylesheet's own.
      if (family) font.family = family.split(',')[0].replace(/["']/g, '').trim();
      if (Object.keys(font).length) b.font = font;
      return b;
    };

    const decorate = (b) => {
      if (align && align !== 'start' && align !== 'left') b.align = align;
      if (own.color) b.color = own.color;
      if (b.type === 'heading' || b.type === 'paragraph') typography(b);

      // A painted widget container. What it MEANS depends on the widget: on a
      // heading it is a badge (the red pills over the hero headline and on the
      // bulk-offer panel), on an icon-box it is the card the box sits in. Kept
      // as one record so the renderer decides, and so "white text" can be told
      // apart from "white text on red".
      /**
       * An image widget's DISPLAY width, authored in CSS rather than in the file.
       *
       * Elementor draws the press logo at `width:40%` of its column while the
       * file itself is 300px wide. Without this the renderer had nothing to go
       * on and stretched every image to its column, which is why the two press
       * logos filled half the viewport each.
       */
      if (b.type === 'image' && own['img-width']) {
        b.displayWidth = own['img-width'];
      }

      if (own['box-background-color']) {
        b.box = {
          bg: own['box-background-color'],
          radius: radius(own['box-border-radius']),
          pad: own['box-padding'] ?? null,
        };
      }
      // An icon-box's glyph is coloured on `.elementor-icon`, separately from
      // its title and its description.
      if (b.type === 'card' && (own['icon-color'] ?? own['icon-fill'])) {
        b.iconColor = own['icon-color'] ?? own['icon-fill'];
      }

      // An icon list carries its own text colour, casing and icon colour: the
      // hero's red check marks beside navy 20px labels, the category sidebar's
      // red arrows. Rendered from the generic defaults they came out as
      // bordered white pills, which appear nowhere on the live site.
      if (b.type === 'list') {
        if (own['listtext-color']) b.textColor = own['listtext-color'];
        if (own['listtext-text-transform']) b.transform = own['listtext-text-transform'];
        if (own['listtext-font-size']) b.fontSize = own['listtext-font-size'];
        const ic = own['icon-color'] ?? own['icon-fill'];
        if (ic) b.iconColor = ic;
      }
      if (b.type === 'button') {
        if (own['btn-background-color']) b.bg = own['btn-background-color'];
        if (own['btn-color']) b.color = own['btn-color'];
        const r = radius(own['btn-border-radius']);
        if (r !== null) b.radius = r;
      }
      const widgetOrder = own.order || own['--order'];
      if (widgetOrder && widgetOrder !== '0') b.order = Number(widgetOrder);
      if (own.display === 'none') b.hide = 'hidden';
      const widgetHide = hideClass(cls);
      if (widgetHide) b.hide = widgetHide;
      return b;
    };

    if (Array.isArray(block)) out.push(...block.map(decorate));
    else out.push(decorate(block));
  }

  return out;
}
