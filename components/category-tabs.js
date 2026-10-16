import ProductCard from '@/components/product-card';
import { label, t } from '@/lib/i18n';
import { dedupeProducts } from '@/lib/dedupe-products';

/**
 * The "Shop By Category" tab strip: one panel of products per category.
 *
 * CSS-ONLY, and deliberately so. A client component that rendered just the
 * active panel would ship 4 of the 27 products and hide the rest from crawlers —
 * the exact regression documented in components/faq-accordion.js. Here every
 * panel is in the served HTML and CSS reveals one at a time, which is also what
 * Elementor's own tabs do on the live site.
 *
 * The control is a radio group, so tab switching, keyboard arrows and focus all
 * come from the platform rather than from re-implemented key handlers.
 *
 * See foldCategoryTabs() in scripts/harvest-blocks.mjs for why the harvested
 * tab titles and product grids arrive as flat siblings and have to be paired.
 */
export default function CategoryTabs({ content, lang, id = 'shop-by-category' }) {
  const items = content.items ?? [];
  if (!items.length) return null;

  // One pair of rules per tab: light up its label, show its panel. Generated
  // here because the tab count comes from the data, not from the design.
  // Keyed on each input's unique id and a matching data-i, NOT on :nth-of-type.
  // nth-of-type counts an element's position among siblings of the same tag, and
  // getting it to line up with the label and panel positions is fragile — it
  // silently pinned the active styling to the first tab no matter which radio
  // was checked. An id cannot be ambiguous.
  const css = items
    .map(
      (_, i) => `
##${id}-${i}:checked ~ .ct-list .ct-tab[data-i="${i}"] {
  border-color: var(--color-accent, #e2683c);
  color: var(--color-accent, #e2683c);
  background-color: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
}
##${id}-${i}:checked ~ .ct-panels .ct-panel[data-i="${i}"] {
  display: block;
}
##${id}-${i}:focus-visible ~ .ct-list .ct-tab[data-i="${i}"] {
  outline: 2px solid var(--color-accent, #e2683c);
  outline-offset: 2px;
}`,
    )
    .join('\n')
    .replace(/##/g, '#');

  return (
    <div id={id}>
      {/* The inactive background lives here rather than in a Tailwind utility,
          so the active rule below has a single thing to override. */}
      <style>{`#${id} .ct-panel{display:none}#${id} .ct-tab{background-color:rgb(255 255 255 / 0.6)}${css}`}</style>

      {items.map((item, i) => (
        <input
          aria-label={label(item, lang)}
          className="ct-radio sr-only"
          defaultChecked={i === 0}
          id={`${id}-${i}`}
          key={`radio-${i}`}
          name={id}
          type="radio"
        />
      ))}

      <div className="ct-list mt-8 flex flex-wrap justify-center gap-2.5">
        {items.map((item, i) => (
          <label
            className="ct-tab cursor-pointer rounded-full border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:border-accent hover:text-accent"
            data-i={i}
            htmlFor={`${id}-${i}`}
            key={`tab-${i}`}
          >
            {label(item, lang)}
          </label>
        ))}
      </div>

      <div className="ct-panels">
        {items.map((item, i) => (
          <div className="ct-panel" data-i={i} key={`panel-${i}`}>
            {t(item, 'body', lang) && (
              <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-text-muted">
                {t(item, 'body', lang)}
              </p>
            )}
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dedupeProducts(item.products).map((product, j) => (
                <ProductCard key={`${product.name}-${j}`} lang={lang} product={product} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
