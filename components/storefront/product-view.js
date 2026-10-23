'use client';

import { useEffect, useMemo, useState } from 'react';
import Ms from '@/components/storefront/icon';
import ProductCard from '@/components/storefront/product-card';
import ProductImage from '@/components/storefront/product-image';
import { shelfLabel } from '@/lib/storefront/shelves.mjs';
import { variantFor } from '@/lib/storefront/group-products.mjs';
import { freeDeliveryProgress, totalsFor } from '@/lib/storefront/cart-math.mjs';
import { DISCLAIMER, FAQ, REVIEWS, WHY } from '@/lib/storefront/content.mjs';

/** The quantity shortcuts, with the discount each one unlocks. */
const QTY_TIERS = [
  { qty: 1, off: '', flag: '' },
  { qty: 3, off: '', flag: '' },
  { qty: 5, off: '15%', flag: 'Popular' },
  { qty: 10, off: '20%', flag: 'Best value' },
];

function Accordion({ question, answer, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`acc${open ? ' on' : ''}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {t(question)}
        <Ms name="expand_more" />
      </button>
      <div className="body" hidden={!open}>
        <p>{t(answer)}</p>
      </div>
    </div>
  );
}

/**
 * One compound, in full.
 *
 * The price shown is the quantity the shopper has selected, already carrying
 * whatever bulk discount that quantity earns — computed with the catalog's own
 * `computeOrderTotals`, so the figure here is the figure checkout will charge.
 */
export default function ProductView({
  compound,
  compounds,
  selectedSize,
  onSelectSize,
  onAdd,
  money,
  t,
  lang,
  currency,
  exchangeRate,
  hrefFor,
  homeHref,
  whatsappFor,
  cart,
  onChangeQty,
  selectedSizes,
}) {
  const [qty, setQty] = useState(5);
  const variant = variantFor(compound, selectedSize);

  // A different compound is a different page: reset the quantity rather than
  // carrying the last one over.
  useEffect(() => setQty(5), [compound.slug]);

  const sizes = compound.variants.map((entry) => entry.size).filter(Boolean);

  const pricing = useMemo(() => {
    if (!variant) return null;
    const line = [{ product: variant.product, qty, priceUsd: variant.priceUsd, priceCrc: variant.priceCrc }];
    const totals = totalsFor(line, currency, exchangeRate);
    const delivery = freeDeliveryProgress(line, currency, exchangeRate);
    const fullUsd = variant.priceUsd * qty;
    const fullCrc = variant.priceCrc * qty;
    return { totals, delivery, fullUsd, fullCrc };
  }, [variant, qty, currency, exchangeRate]);

  if (!variant || !pricing) return null;

  const { totals, delivery, fullUsd, fullCrc } = pricing;
  const discounted = totals.discountPct > 0;
  const related = compounds
    .filter((entry) => entry.slug !== compound.slug && entry.shelf === compound.shelf && entry.inStock)
    .slice(0, 4);

  const facts = [
    ['Form', compound.liquid ? 'Liquid, ready to use' : 'Lyophilized powder'],
    ['Strengths', sizes.join(' · ') || '—'],
    ['Category', shelfLabel(compound.shelf, lang)],
    ['Storage', '2–8 °C, away from light'],
    ['Documentation', 'Batch Certificate of Analysis'],
  ];

  const description = lang === 'es'
    ? compound.descriptionEs || compound.descriptionEn
    : compound.descriptionEn || compound.descriptionEs;

  return (
    <div className="pview">
      <div className="wrap">
        <a className="crumb" href={homeHref}>
          <Ms name="arrow_back" />
          {t('All compounds')}
        </a>

        <div className="pgrid">
          <div className="pgal">
            <div className="tags">
              {compound.best ? <span className="tg best">{t('Best seller')}</span> : <span />}
            </div>
            <ProductImage src={variant.image || compound.image} alt={`${compound.name} ${variant.size}`} />
            {compound.shelf !== 'supplies' ? (
              <div className="giftb">
                <span>
                  {t('Free BAC Water')}
                  <small>{t('with every order')}</small>
                </span>
              </div>
            ) : null}
          </div>

          <div className="pinfo">
            <span className="cat-l">{shelfLabel(compound.shelf, lang)}</span>
            <h1>{compound.name}</h1>

            <div className="prow">
              <span className="st">★★★★★</span>
              <span>5.0 Google · 4.6 Trustpilot</span>
              <span className={`stock${variant.inStock ? '' : ' out'}`}>
                {variant.inStock ? t('In stock') : t('Out of stock')}
              </span>
            </div>

            <div className="big-price">
              <b className="num">{money(totals.total, totals.total)}</b>
              {discounted ? <s className="num">{money(fullCrc, fullUsd)}</s> : null}
              {discounted ? (
                <span className="save">
                  {t(`Save ${money(totals.discountAmount, totals.discountAmount)}`)}
                </span>
              ) : null}
            </div>
            <div className="perline">
              {`${money(variant.priceCrc, variant.priceUsd)} ${t('per vial')} · ${t(`${qty} vial${qty === 1 ? '' : 's'}`)}`}
              {totals.shipping === 0 ? ` · ${t('Free delivery')}` : ''}
            </div>

            {sizes.length ? (
              <div className="blk">
                <div className="lab">
                  {t('Strength')}
                  <span>{t(`${sizes.length} option${sizes.length === 1 ? '' : 's'}`)}</span>
                </div>
                <div className="psizes">
                  {compound.variants.map((entry) => (
                    <button
                      className={`sz${entry.inStock ? '' : ' oos'}`}
                      type="button"
                      key={entry.size}
                      aria-pressed={entry.size === variant.size}
                      onClick={() => onSelectSize(compound.slug, entry.size)}
                    >
                      {entry.size}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="blk">
              <div className="lab">
                {t('Quantity')}
                <span>{t('Best discount applies automatically')}</span>
              </div>
              <div className="tiers">
                {QTY_TIERS.map((tier) => (
                  <button
                    className="tier"
                    type="button"
                    key={tier.qty}
                    aria-pressed={qty === tier.qty}
                    onClick={() => setQty(tier.qty)}
                  >
                    {tier.flag ? <span className="flag">{t(tier.flag)}</span> : null}
                    <b>{tier.qty}</b>
                    <small>{t(`vial${tier.qty > 1 ? 's' : ''}`)}</small>
                    <em>{tier.off ? `−${tier.off}` : ''}</em>
                  </button>
                ))}
              </div>

              <div className="qline">
                <span>{t('Custom quantity')}</span>
                <div className="step">
                  <button type="button" aria-label={t('One less')} onClick={() => setQty((value) => Math.max(1, value - 1))}>
                    <Ms name="remove" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    aria-label={t('Quantity')}
                    value={qty}
                    onChange={(event) => {
                      const next = Math.max(1, Math.min(99, Math.floor(Number(event.target.value) || 1)));
                      setQty(next);
                    }}
                  />
                  <button type="button" aria-label={t('One more')} onClick={() => setQty((value) => Math.min(99, value + 1))}>
                    <Ms name="add" />
                  </button>
                </div>
              </div>
            </div>

            <div className="shipbar">
              <div className="t">
                <span>
                  {delivery.reached
                    ? t('Free delivery unlocked')
                    : t(`Add ${money(delivery.remaining, delivery.remaining)} for free delivery`)}
                </span>
              </div>
              <div className={`track${delivery.reached ? ' done' : ''}`}>
                <i style={{ width: `${delivery.percent}%` }} />
                <span className="mk"><Ms name="local_shipping" /></span>
              </div>
            </div>

            <div className="ctarow">
              {variant.inStock ? (
                <button className="btn block" type="button" onClick={() => onAdd(compound, variant, qty)}>
                  <Ms name="add_shopping_cart" />
                  {t('Add to order')}
                </button>
              ) : (
                <a
                  className="btn ghost block"
                  href={whatsappFor(`Hi! Please let me know when ${compound.name} ${variant.size} is back in stock.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Ms name="notifications" />
                  {t('Notify me')}
                </a>
              )}
            </div>

            <div className="assure">
              <span><Ms name="verified" />{t('Batch COA with every order')}</span>
              <span><Ms name="payments" />{t('Pay cash on delivery')}</span>
              <span><Ms name="schedule" />{t('2–4 day delivery')}</span>
            </div>
          </div>
        </div>

        <div className="twocol">
          <section className="psec">
            <h2>{t('Specifications')}</h2>
            {description ? <p className="muted" style={{ marginBottom: '14px' }}>{description}</p> : null}
            <div className="specs">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <span>{t(label)}</span>
                  <span>{t(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="psec">
            <h2>{t('Questions')}</h2>
            <div className="faq">
              {FAQ.map(([question, answer]) => (
                <Accordion key={question} question={question} answer={answer} t={t} />
              ))}
            </div>
          </section>
        </div>

        <section className="psec">
          <h2>{t('Why order from us')}</h2>
          <div className="why">
            {WHY.map((item) => (
              <div key={item.icon}>
                <Ms name={item.icon} />
                <b>{t(item.title)}</b>
                <small>{t(item.note)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="psec">
          <h2>{t('What people say')}</h2>
          <div className="revs">
            {REVIEWS.map(([platform, quote, who]) => (
              <div className="rev" key={who}>
                <div className="top">
                  <span>{platform}</span>
                  <span className="st">★★★★★</span>
                </div>
                <q>{quote}</q>
                <div className="who">{who}</div>
              </div>
            ))}
          </div>
        </section>

        {related.length ? (
          <section className="psec">
            <h2>{t(`More in ${shelfLabel(compound.shelf, lang)}`)}</h2>
            <div className="related grid">
              {related.map((entry) => (
                <ProductCard
                  key={entry.slug}
                  compound={entry}
                  selectedSize={selectedSizes[entry.slug]}
                  onSelectSize={onSelectSize}
                  inCartQty={cart.find((line) => line.product === (
                    variantFor(entry, selectedSizes[entry.slug])?.product
                  ))?.qty || 0}
                  onAdd={onAdd}
                  onChangeQty={onChangeQty}
                  money={money}
                  t={t}
                  lang={lang}
                  href={hrefFor(entry.slug)}
                  whatsappFor={whatsappFor}
                />
              ))}
            </div>
          </section>
        ) : null}

        <p className="disc">
          <b>{t('Research use only.')}</b> {t(DISCLAIMER)}
        </p>
      </div>
    </div>
  );
}
