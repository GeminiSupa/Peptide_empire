'use client';

import Ms from '@/components/storefront/icon';
import ProductImage from '@/components/storefront/product-image';
import { shelfLabel } from '@/lib/storefront/shelves.mjs';
import { variantFor } from '@/lib/storefront/group-products.mjs';

/**
 * One compound on the shelf.
 *
 * The strength picker shows at most two chips and puts the rest in a "More"
 * menu, which is what keeps a ten-strength compound like GLP-1 from making
 * the card three times taller than its neighbours on a phone.
 */
export default function ProductCard({
  compound,
  selectedSize,
  onSelectSize,
  inCartQty,
  onAdd,
  onChangeQty,
  money,
  t,
  lang,
  href,
  whatsappFor,
}) {
  const variant = variantFor(compound, selectedSize);
  if (!variant) return null;

  const sizes = compound.variants.map((entry) => entry.size).filter(Boolean);
  // The chosen strength leads, so the first chip always shows what is
  // selected. That matters because the second chip is dropped on a phone,
  // where a 166px card cannot hold two chips and the "More" menu.
  const ordered = [
    variant.size,
    ...sizes.filter((size) => size !== variant.size),
  ].filter(Boolean);
  const chips = ordered.slice(0, 2);
  const rest = ordered.slice(2);
  const restHolds = rest.includes(variant.size);

  return (
    <article className="card">
      <a className="ph" href={href} aria-label={`${t('View')} ${compound.name}`}>
        <div className="tags">
          {compound.best ? <span className="tg best">{t('Best seller')}</span> : <span />}
          {compound.inStock ? null : <span className="tg oos">{t('Out of stock')}</span>}
        </div>
        <ProductImage loading="lazy" src={variant.image || compound.image} alt={`${compound.name} ${variant.size}`} />
      </a>

      <div className="cbody">
        <span className="cat-l">{shelfLabel(compound.shelf, lang)}</span>
        <a className="cname" href={href}>{compound.name}</a>

        <div className="sizes">
          {sizes.length > 1 ? (
            <>
              {chips.map((size) => (
                <button
                  className={`sz${variantFor(compound, size)?.inStock ? '' : ' oos'}`}
                  type="button"
                  key={size}
                  aria-pressed={size === variant.size}
                  onClick={() => onSelectSize(compound.slug, size)}
                >
                  {size}
                </button>
              ))}
              {rest.length ? (
                <select
                  className={`sz${restHolds ? ' on' : ''}`}
                  aria-label={t('More strengths')}
                  value={restHolds ? variant.size : ''}
                  onChange={(event) => {
                    if (event.target.value) onSelectSize(compound.slug, event.target.value);
                  }}
                >
                  <option value="">{t('More')}</option>
                  {rest.map((size) => (
                    <option value={size} key={size}>
                      {variantFor(compound, size)?.inStock ? size : `${size} (${t('out')})`}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : (
            <button className="sz" type="button" aria-pressed tabIndex={-1}>
              {variant.size || compound.name}
            </button>
          )}
        </div>

        <div className="pr">
          <b className="num">{money(variant.priceCrc, variant.priceUsd)}</b>
          <small>
            {t('per vial')}
            {variant.inStock ? '' : ` · ${t('out of stock')}`}
          </small>
        </div>

        <div className="addrow">
          {!variant.inStock ? (
            <a
              className="btn ghost notify"
              href={whatsappFor(`Hi! Please let me know when ${compound.name} ${variant.size} is back in stock.`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Ms name="notifications" />
              {t('Notify me')}
            </a>
          ) : inCartQty > 0 ? (
            <div className="qctl">
              <button type="button" aria-label={t('One less')} onClick={() => onChangeQty(variant.product, inCartQty - 1)}>
                <Ms name="remove" />
              </button>
              <b className="num">{t(`${inCartQty} in order`)}</b>
              <button type="button" aria-label={t('One more')} onClick={() => onChangeQty(variant.product, inCartQty + 1)}>
                <Ms name="add" />
              </button>
            </div>
          ) : (
            <button className="btn" type="button" onClick={() => onAdd(compound, variant)}>
              <Ms name="add_shopping_cart" />
              {t('Add')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
