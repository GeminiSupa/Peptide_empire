import { createElement, Fragment } from 'react';
import Link from 'next/link';
import CopyBlock from '@/components/site/copy-block';
import ProductGrid from '@/components/site/product-grid';
import ProductImage from '@/components/storefront/product-image';
import ProtoInteractions, { LabCalc, OpenNow } from '@/components/site/proto-interactions';
import { BulkCalc, BulkExamples, PerMg } from '@/components/site/bulk-tools';
import { AffiliateForm, ContactForm, ProForm } from '@/components/site/lead-forms';
import { CategoryTiles } from '@/components/site/blocks';
import ReviewBar, { ReviewMark } from '@/components/site/review-bar';
import { ShopperRotating } from '@/components/site/review-widgets';
import { CATEGORIES, CONTACT, categoryHref, pageHref, NEW_PAGES } from '@/lib/site/links.mjs';
import { localePath, routeGroup } from '@/lib/routes';
import { imageUrl } from '@/lib/images';
import { translator } from '@/lib/storefront/i18n.mjs';

/**
 * A page drawn from the prototype's own rendering (data/site/pages/*.json,
 * written by scripts/import-pages.mjs), as server-rendered React.
 *
 * On the way out each element is put right for the live site:
 *  - `#key` links become the live URL of that page, category or product, or
 *    stay in-page anchors when the page has that id;
 *  - `data-wa` links open WhatsApp with their message;
 *  - text is translated for Spanish, and the prototype's frozen figures
 *    (compound count, COA count, free-delivery threshold) become live ones;
 *  - the H1 is the live page's own. Where the design sets a kicker over a
 *    headline, the kicker carries the live H1 and the headline is kept as
 *    styled text, so the design and the indexed H1 both survive;
 *  - review widgets, product grids, category tiles and product photos are the
 *    live components, not the snapshot's copies.
 */

const ATTR_NAMES = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', inputmode: 'inputMode',
  autocomplete: 'autoComplete', colspan: 'colSpan', rowspan: 'rowSpan', readonly: 'readOnly',
  maxlength: 'maxLength', viewbox: 'viewBox', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule',
  'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
  'xmlns:xlink': 'xmlnsXlink', 'xlink:href': 'xlinkHref', 'stroke-dasharray': 'strokeDasharray', 'stroke-dashoffset': 'strokeDashoffset',
};
const BOOLEAN = new Set(['required', 'disabled', 'hidden', 'open']);

/**
 * Marketing photos of the old vial design, which no longer matches what
 * customers receive. Their figures are left out until new photos replace them;
 * a split that loses its picture runs as one column (site-base.css).
 */
const RETIRED_IMAGES = [
  'homepage-vial-images.webp',
  'banner-new.webp',
  'secure-peptide-packaging-',
  'faq-banner-',
  'Untitled-design-9-',
];
const isRetired = (src) => typeof src === 'string' && RETIRED_IMAGES.some((name) => src.split('/').pop().startsWith(name));
const VOID = new Set(['img', 'input', 'br', 'hr', 'source', 'meta', 'link', 'col', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop']);

function styleObject(css) {
  const out = {};
  for (const rule of String(css).split(';')) {
    const at = rule.indexOf(':');
    if (at < 0) continue;
    const prop = rule.slice(0, at).trim();
    const value = rule.slice(at + 1).trim();
    if (!prop || !value) continue;
    out[prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out;
}

function textOf(node) {
  if (typeof node === 'string') return node;
  if (!Array.isArray(node) || String(node[0]).startsWith('$')) return '';
  return node.slice(2).map(textOf).join('');
}

function findTag(node, tag) {
  if (!Array.isArray(node)) return null;
  if (node[0] === tag) return node;
  for (const child of node.slice(2)) {
    const found = findTag(child, tag);
    if (found) return found;
  }
  return null;
}

function collectIds(node, ids) {
  if (!Array.isArray(node)) return ids;
  const [, attrs, ...children] = node;
  if (attrs?.id) ids.add(attrs.id);
  for (const child of children) collectIds(child, ids);
  return ids;
}

/** The live URL a prototype `#key` link means, in `lang`. */
export function resolveKey(key, lang, ids = new Set()) {
  if (!key) return pageHref('home', lang);
  if (ids.has(key)) return `#${key}`;
  if (NEW_PAGES[key]) return pageHref(key, lang);
  try { return pageHref(key, lang); } catch { /* not a page key */ }
  const category = CATEGORIES.find((entry) => entry.slug === key);
  if (category) return categoryHref(category, lang);
  if (routeGroup(`/${key}/`)) return localePath(`/${key}/`, lang);
  return pageHref('catalog', lang);
}

/** Live figures in place of the numbers frozen into the snapshot. */
function liveFigures(text, vars) {
  const replaced = (vars.replacements || []).reduce((out, [from, to]) => out.split(from).join(to), text);
  return replaced
    .replace(/\b48(?= (research )?compounds| compuestos)/g, String(vars.compoundCount))
    .replace(/\b25(?= COAs?\b)/g, String(vars.coaCount))
    .replace(/₡90,896/g, vars.freeShippingLabel);
}

function render(node, ctx, key) {
  if (node == null) return null;
  if (typeof node === 'string') {
    // Translated first, so the dictionary keys on the designer's text;
    // the live figures are filled into the result, in either language.
    const trimmed = node.trim();
    if (!trimmed) return node;
    const lead = node.startsWith(' ') ? ' ' : '';
    const tail = node.endsWith(' ') && node.length > 1 ? ' ' : '';
    return `${lead}${liveFigures(ctx.t(trimmed), ctx.vars)}${tail}`;
  }

  const [tag, attrs, ...children] = node;

  // Widgets the site draws from live data.
  switch (tag) {
    // Every review mention is the one ReviewBar; the seal beside it is folded in.
    case '$trustpilot': return <ReviewBar key={key} reviews={ctx.site.reviews} lang={ctx.lang} />;
    case '$shopperLink': return null;
    case '$shopperRotating': return <ShopperRotating key={key} lang={ctx.lang} />;
    case '$categories': return <CategoryTiles key={key} categories={ctx.site.categories} t={ctx.t} />;
    case '$products': {
      const compounds = attrs.names.map((name) => ctx.byName(name)).filter(Boolean);
      return compounds.length ? <ProductGrid key={key} compounds={compounds} className={attrs.className || 'grid'} /> : null;
    }
    case '$productImage': {
      const compound = ctx.byLabel(attrs.label);
      return <ProductImage key={key} className={attrs.className || ''} src={compound?.image} alt="" />;
    }
    case '$bulkCalc': return <BulkCalc key={key} compounds={ctx.site.compounds} />;
    case '$bulkExamples': return <BulkExamples key={key} compounds={ctx.site.compounds} />;
    case '$perMg': return <PerMg key={key} compounds={ctx.site.compounds} />;
    case '$coaList': return <CoaList key={key} compounds={ctx.site.compounds} t={ctx.t} />;
    case '$labCalc': return <LabCalc key={key} />;
    case '$openNow': return <OpenNow key={key} />;
    case '$contactForm': return <ContactForm key={key} />;
    case '$affiliateForm': return <AffiliateForm key={key} />;
    case '$proForm': return <ProForm key={key} />;
    case '$liveCopy':
      return (
        <Fragment key={key}>
          {(ctx.copy?.blocks || []).map((block) => (
            <CopyBlock block={block} t={ctx.t} lang={ctx.lang} key={block.title || block.paras[0]} />
          ))}
        </Fragment>
      );
    default: break;
  }

  if (tag === 'div' && attrs?.class === 'hseal') return null;
  // A proof strip's "logo 4.6 Trustpilot" item: the platform's mark and its live score.
  const proofSource = tag === 'span' && Array.isArray(children[0]) && children[0][0] === 'img'
    ? { '/site/trustpilot.webp': ['trustpilot', 'Trustpilot'], '/site/google.webp': ['google', 'Google'] }[children[0][1]?.src]
    : null;
  if (proofSource && Array.isArray(children[1]) && children[1][0] === 'b') {
    const [source, name] = proofSource;
    const score = ctx.site.reviews?.[source]?.score;
    return <span key={key} className="pbrate"><ReviewMark source={source} /><b>{score ? score.toFixed(1) : children[1][2]}</b>{name}</span>;
  }

  if (tag === 'figure' && children.some((child) => Array.isArray(child) && child[0] === 'img' && isRetired(child[1]?.src))) return null;

  // The live H1 (see above).
  const cls = ` ${attrs?.class || ''} `;
  if (ctx.h1 && ctx.swapKicker && !ctx.state.h1Done && tag === 'span' && cls.includes(' eyebrow ') && ctx.state.inHero) {
    ctx.state.h1Done = true;
    ctx.state.kicker = true;
    return <h1 key={key} className="eyebrow">{ctx.h1}</h1>;
  }
  if (tag === 'h1') {
    if (ctx.state.kicker || ctx.state.h1Done) {
      return <p key={key} className="h1">{children.map((child, index) => render(child, ctx, index))}</p>;
    }
    ctx.state.h1Done = true;
    return <h1 key={key}>{ctx.h1 || children.map((child, index) => render(child, ctx, index))}</h1>;
  }

  const props = {};
  for (const [name, value] of Object.entries(attrs || {})) {
    if (name === 'data-wa') continue;
    if (name === 'style') { props.style = styleObject(value); continue; }
    if (BOOLEAN.has(name)) { props[name] = true; continue; }
    if (name === 'checked') { props.defaultChecked = true; continue; }
    if (name === 'value' && (tag === 'input' || tag === 'textarea')) { props.defaultValue = value; continue; }
    if ((name === 'placeholder' || name === 'alt' || name === 'aria-label' || name === 'title') && value) {
      props[name] = liveFigures(ctx.t(value), ctx.vars);
      continue;
    }
    if (name === 'src' && /^https:\/\/peptidescostarica\.net\/wp-content\//.test(value)) {
      // `photo.jpg.webp` is the WordPress optimiser's copy, which the site's
      // mirror doesn't hold; the original upload beside it is the same picture.
      props.src = imageUrl(value.replace('https://peptidescostarica.net', '').replace(/\.(jpe?g|png)\.webp$/i, '.$1'));
      continue;
    }
    props[ATTR_NAMES[name] || name] = value;
  }

  if (tag === 'a' && attrs?.['data-wa'] != null) {
    props.href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(ctx.t(attrs['data-wa']))}`;
    props.target = '_blank';
    props.rel = 'noopener noreferrer';
  }

  const wasHero = ctx.state.inHero;
  if (cls.includes(' phc ') || cls.includes(' bhero ') || cls.includes(' chead ')) ctx.state.inHero = true;
  const kids = VOID.has(tag) ? null : children.map((child, index) => render(child, ctx, index));
  ctx.state.inHero = wasHero;

  if (tag === 'a' && typeof attrs?.href === 'string' && attrs.href.startsWith('#') && attrs['data-wa'] == null) {
    const href = resolveKey(attrs.href.slice(1), ctx.lang, ctx.ids);
    delete props.href;
    return createElement(href.startsWith('#') ? 'a' : Link, { ...props, href, key }, ...kids);
  }
  return kids ? createElement(tag, { ...props, key }, ...kids) : createElement(tag, { ...props, key });
}

/** The COA database: every compound with a published certificate, linked to it. */
function CoaList({ compounds, t }) {
  return (
    <div className="coatable" id="coaList">
      {compounds.filter((compound) => compound.coa).map((compound) => (
        <div className="coar" data-n={compound.name.toLowerCase()} key={compound.slug}>
          <span className="cim2"><ProductImage src={compound.image} alt="" loading="lazy" /></span>
          <div>
            <b>{compound.name}</b>
            <small>{`${compound.defaultSize} · ${t('Certificate of Analysis')}`}</small>
          </div>
          <a className="btn ghost sm" href={compound.coa} target="_blank" rel="noopener noreferrer">
            <span className="ms">download</span>PDF
          </a>
          <Link className="btn sm" href={compound.href}>{t('See product')}</Link>
        </div>
      ))}
    </div>
  );
}

/**
 * Draw `tree` for `lang`. `site` is getSiteData's result; `h1` the live
 * page's H1; `copy` its live copy, for any "copy migrates here" slot;
 * `replacements` swaps words in the snapshot's text, for a snapshot that
 * stands for a whole template (the Alajuela page draws every city).
 */
export default function ProtoPage({ tree, lang, site, h1, copy, replacements = [] }) {
  const t = translator(lang);
  const byName = (name) => site.compounds.find((compound) => compound.name === name);
  const byLabel = (label) => {
    const text = String(label || '');
    return site.compounds
      .filter((compound) => text === compound.name || text.startsWith(`${compound.name} `))
      .sort((a, b) => b.name.length - a.name.length)[0] || null;
  };
  const ctx = {
    t,
    lang,
    site,
    h1,
    copy,
    byName,
    byLabel,
    ids: collectIds(tree, new Set()),
    vars: {
      compoundCount: site.compounds.length,
      coaCount: site.compounds.filter((compound) => compound.coa).length,
      freeShippingLabel: site.freeShippingLabel,
      replacements,
    },
    state: { h1Done: false, kicker: false, inHero: false },
  };
  // When the design's headline already is the live H1, it stays the H1.
  const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, ' ').trim();
  ctx.swapKicker = Boolean(h1) && norm(textOf(findTag(tree, 'h1'))) !== norm(h1);
  return (
    <>
      {render(tree, ctx, 'root')}
      <ProtoInteractions />
    </>
  );
}
