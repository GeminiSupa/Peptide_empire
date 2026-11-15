// Turn the prototype's rendered pages into data the site renders on the server.
//
// Usage: node scripts/import-pages.mjs
//
// The designer's prototype (docs/design/peptides-costa-rica-site.html) draws
// every page in the browser with JavaScript. docs/design/rendered/ holds each
// page as the prototype drew it: the HTML of its view, captured from a
// browser, with inline images replaced by `IMG` / `CRMIMG` placeholders. This
// script reads those snapshots and writes data/site/pages/<key>.json — a
// compact element tree that components/site/proto-page.js renders as real
// React elements, with links resolved to live URLs, Spanish applied, live
// figures filled in and the live product, review and category widgets put
// back.
//
// Tree format: a string is text; an element is `[tag, attrs, ...children]`;
// a widget the site draws itself is `['$name', props]`.
//
// Re-run after replacing a snapshot. Never hand-edit the JSON.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const IN = path.join(ROOT, 'docs/design/rendered');
const OUT = path.join(ROOT, 'data/site/pages');

/** Pages drawn from their snapshot. Data-heavy views have components instead. */
const PAGES = [
  'about', 'our-story', 'our-process', 'affiliate-program', 'for-professionals',
  'contact-costa-rica', 'faq-costa-rica', 'info-center', 'our-service-locations',
  'customer-feedback', 'explore-our-app', 'thank-you', 'shipping-policy',
  'return-refund-policy', 'privacy-policy', 'bulk-discounts', 'alajuela',
  'lab-tests-coa-results',
];

const KEEP = new Set([
  'class', 'id', 'href', 'src', 'alt', 'type', 'name', 'placeholder', 'value',
  'required', 'checked', 'disabled', 'hidden', 'rows', 'min', 'max', 'step',
  'inputmode', 'autocomplete', 'target', 'rel', 'style', 'role', 'for',
  'tabindex', 'loading', 'open', 'colspan', 'rowspan', 'lang',
  'data-wa', 'data-t', 'data-step', 'data-jump', 'data-k', 'data-v', 'data-q',
  'data-cta', 'data-deal', 'data-os', 'data-p',
]);
const INLINE = new Set([
  'a', 'b', 'strong', 'em', 'i', 'small', 'span', 'label', 'q', 'code', 'sup', 'sub', 'u', 's',
  'p', 'li', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption', 'summary', 'td', 'th', 'option', 'dt', 'dd',
]);

function attrsOf(el, svg) {
  const out = {};
  for (const [name, value] of Object.entries(el.attribs || {})) {
    if (svg || KEEP.has(name) || name.startsWith('aria-')) out[name] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** An `IMG` placeholder's real file, from its alt text or the words beside it. */
function brandImage($, el) {
  const alt = String(el.attribs.alt || '').toLowerCase();
  const near = alt || $(el).parent().text().toLowerCase();
  for (const key of ['google', 'trustpilot', 'facebook']) if (near.includes(key)) return `/site/${key}.webp`;
  if (near.includes('tico')) return '/site/press-tico-times.webp';
  if (near.includes('costa rica news')) return '/site/press-costa-rica-news.webp';
  if (near.includes('nación') || near.includes('nacion')) return '/site/press-la-nacion.webp';
  return null;
}

function convert($, node, svg = false) {
  if (node.type === 'text') {
    const text = node.data.replace(/\s+/g, ' ');
    if (!text.trim()) {
      const parent = node.parent?.name;
      return parent && INLINE.has(parent) ? ' ' : null;
    }
    return text;
  }
  if (node.type !== 'tag') return null;
  const el = node;
  const $el = $(el);
  const cls = ` ${el.attribs.class || ''} `;
  const isSvg = svg || el.name === 'svg';

  if (el.name === 'script' || el.name === 'style') return null;
  if (cls.includes(' trustpilot-widget ')) {
    return ['$trustpilot', { dark: el.attribs['data-theme'] === 'dark', className: (el.attribs.class || '').replace('trustpilot-widget', '').trim() }];
  }
  if (cls.includes(' shopperlink ')) return ['$shopperLink', null];
  if (cls.includes(' sawrap ')) return ['$shopperRotating', null];
  if (cls.includes(' widget ')) return null;
  if (cls.includes(' devnote ')) return ['$liveCopy', null];
  // Live data the site draws itself.
  if (cls.includes(' grid ') && $el.find('article.card').length) {
    return ['$products', { names: $el.find('.cname').map((_, a) => $(a).text().trim()).get(), className: el.attribs.class }];
  }
  if (cls.includes(' ctiles ')) return ['$categories', null];
  if (cls.includes(' calc ') && $el.closest('#bulkcalc').length) return ['$bulkCalc', null];
  if (el.attribs.id === 'exRows') return ['tbody', { id: 'exRows' }, ['$bulkExamples', null]];
  // Lead forms are components: the snapshot holds only their visible step.
  if (cls.includes(' fsteps ')) return null;
  if (el.name === 'form' && el.attribs.id === 'ctForm') return ['$contactForm', null];
  if (el.name === 'form' && el.attribs.id === 'affForm') return ['$affiliateForm', null];
  if (el.name === 'form' && el.attribs.id === 'proForm') return ['$proForm', null];
  if (el.attribs.id === 'coaList') return ['$coaList', null];
  if (el.attribs.id === 'lcalc') return ['$labCalc', null];
  if (el.attribs.id === 'openNow') return ['$openNow', null];
  if (el.attribs.id === 'permg') return ['div', { id: 'permg' }, ['$perMg', null]];
  if (el.name === 'img' && (el.attribs.src === 'IMG' || el.attribs.src === 'CRMIMG')) {
    if (el.attribs.src === 'CRMIMG') {
      const label = el.attribs.alt || $el.closest('a').find('b').first().text();
      return ['$productImage', { label, className: el.attribs.class || null }];
    }
    const src = brandImage($, el);
    return src ? ['img', { ...attrsOf(el), src }] : null;
  }

  const attrs = attrsOf(el, isSvg);
  const children = [];
  for (const child of el.children || []) {
    const converted = convert($, child, isSvg);
    if (converted != null) children.push(converted);
  }
  return [el.name, attrs, ...children];
}

fs.mkdirSync(OUT, { recursive: true });
for (const key of PAGES) {
  const html = fs.readFileSync(path.join(IN, `${key}.html`), 'utf8');
  const $ = cheerio.load(html);
  const root = $('#page').length ? $('#page') : $('main').children().first();
  const tree = convert($, root.get(0));
  fs.writeFileSync(path.join(OUT, `${key}.json`), `${JSON.stringify(tree)}\n`);
  console.log(key, `${(JSON.stringify(tree).length / 1024).toFixed(1)} KB`);
}
