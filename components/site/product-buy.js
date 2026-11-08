'use client';

import { useEffect, useMemo, useState } from 'react';
import { recordProductView } from '@/lib/site/crm.mjs';
import Ms from '@/components/storefront/icon';
import ProductImage from '@/components/storefront/product-image';
import { useSite } from '@/components/site/site-provider';
import ReviewBar from '@/components/site/review-bar';
import { variantFor } from '@/lib/storefront/group-products.mjs';
import { shelfLabel } from '@/lib/storefront/shelves.mjs';
import { freeShippingThreshold } from '@/lib/storefront/cart-math.mjs';
import { deliveryProgress, lineFor, withLine } from '@/lib/site/quote.mjs';
import { ecommerceData, pushEvent } from '@/lib/site/analytics.mjs';
import { STANDARD_FIVE_PLUS_PCT, tenPlusDiscountPct } from '@/lib/catalog-pricing/bulkDeal.mjs';

/** Up to four strengths show as chips; more put all but three in a menu. */
function strengthChips(compound, selected) {
  const sizes = compound.variants.map((variant) => variant.size).filter(Boolean);
  if (sizes.length <= 4) return { chips: sizes, more: [] };
  const top = [compound.defaultSize, ...compound.variants
    .filter((variant) => variant.inStock && variant.size !== compound.defaultSize)
    .map((variant) => variant.size)]
    .slice(0, 3)
    .sort((a, b) => parseFloat(a) - parseFloat(b));
  return { chips: top, more: sizes.filter((size) => !top.includes(size)), selectedInMore: !top.includes(selected) };
}

/**
 * The product view's buy box: photo, strength, quantity, price, the deal or
 * the volume presets, delivery progress, and the add buttons.
 *
 * Every figure is a quote of the cart as it would be with this line in it,
 * from the catalog's own checkout pricing — so the price shown here is the
 * price the order is charged, deal and volume discount included, never both.
 *
 * While a Spend & Save deal runs the 1/3/5/10 presets hide and the quantity
 * starts at 1: the order total decides the discount, shown as one ladder.
 * Otherwise the presets and volume pricing show, starting at 5.
 */
export default function ProductBuy({ compound, initialSize, h1, bac, companion, reviews }) {
  const {
    t, lang, currency, exchangeRate, cart, quoteFor, money, dealView,
    addToCart, setQty, setSheetOpen, whatsapp, setToast,
  } = useSite();

  const dealMode = Boolean(dealView?.tiers?.length);
  const supplies = compound.shelf === 'supplies';
  const [size, setSize] = useState(initialSize || compound.defaultSize);
  const [qty, setQ] = useState(dealMode ? 1 : 5);
  const [fbtOn, setFbtOn] = useState({ bac: true, comp: false });
  const variant = variantFor(compound, size);
  const setQtyClamped = (value) => setQ(Math.max(1, Math.min(99, Math.trunc(Number(value)) || 1)));

  useEffect(() => {
    pushEvent({
      event: 'view_item',
      ecommerce: ecommerceData([{ name: compound.name, size: variant.size, priceUsd: variant.priceUsd, qty: 1, category: compound.category }]),
    });
    // The CRM's record of what this visitor looked at, as the catalog keeps it.
    let contact = null;
    try {
      const saved = JSON.parse(window.localStorage.getItem('pcr_store_details') || '{}');
      contact = String(saved.phone || '').replace(/\D/g, '') || String(saved.email || '').trim() || null;
    } catch {
      // Anonymous view.
    }
    recordProductView({ product: variant.product, productId: variant.id, contact });
    // Once per page view, for the strength the page opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inCart = cart.find((line) => line.product === variant.product);
  const priced = useMemo(() => {
    const at = (n) => quoteFor(withLine(cart, lineFor(compound, variant, n)));
    const quote = at(qty);
    const unit = currency === 'USD' ? variant.priceUsd : variant.priceCrc;
    const full = unit * qty;
    const pct = quote ? quote.discountPct : 0;
    return { at, quote, unit, full, pct, tot: full * (1 - pct) };
  }, [cart, compound, variant, qty, currency, quoteFor]);
  const { quote, unit, full, pct, tot } = priced;

  const rate = currency === 'USD' ? 1 : exchangeRate;
  const m = (amount) => money(amount, amount);
  const sub = quote ? quote.subtotal : full;
  const progress = deliveryProgress(quote, freeShippingThreshold(currency, exchangeRate));
  const pctLabel = Math.round(pct * 100);

  // The volume nudge: the next tier, if reaching it would beat today's discount.
  const nextQty = qty < 5 ? 5 : qty < 10 ? 10 : 0;
  const nextQuote = !dealMode && nextQty && !supplies ? priced.at(nextQty) : null;
  const nudge = nextQuote && nextQuote.discountPct > pct ? {
    to: nextQty,
    pct: Math.round(nextQuote.discountPct * 100),
    save: unit * nextQty * nextQuote.discountPct,
  } : null;

  // The deal ladder: where this order sits, and what the next step needs.
  const ladder = dealMode ? dealView.tiers.map((tier) => ({ ...tier, at: tier.minUsd * rate })) : [];
  const nextStep = ladder.find((tier) => sub < tier.at);
  const top = ladder.length ? ladder[ladder.length - 1].at : 0;
  const other = sub - full;

  const { chips, more, selectedInMore } = strengthChips(compound, size);

  const addThis = () => {
    if (inCart) setQty(variant.product, qty);
    else addToCart(compound, variant, qty);
    setSheetOpen(true);
  };

  const fbtItems = [
    { id: 'main', compound, variant, on: true, locked: true },
    bac && !supplies ? { id: 'bac', compound: bac.compound, variant: bac.variant, on: fbtOn.bac } : null,
    companion ? { id: 'comp', compound: companion.compound, variant: companion.variant, on: fbtOn.comp } : null,
  ].filter(Boolean);
  const fbtTotal = fbtItems
    .filter((item) => item.on)
    .reduce((sum, item) => sum + (currency === 'USD' ? item.variant.priceUsd : item.variant.priceCrc), 0);
  const addSelected = () => {
    let n = 0;
    for (const item of fbtItems.filter((entry) => entry.on)) {
      if (item.id === 'main') {
        if (inCart) setQty(variant.product, qty); else addToCart(compound, variant, qty);
      } else {
        addToCart(item.compound, item.variant, 1);
      }
      n += 1;
    }
    setToast(t(`${n} items added`));
    setSheetOpen(true);
  };

  const tiers = [
    { q: 1 }, { q: 3 },
    { q: 5, off: STANDARD_FIVE_PLUS_PCT, flag: 'Popular' },
    { q: 10, off: tenPlusDiscountPct(), flag: 'Best value' },
  ];

  return (
    <div className="pgrid">
      <div className="pgal" style={{ '--t': 'var(--tint)' }}>
        <div className="tags">
          {compound.best ? <span className="tg best">{t('Best seller')}</span> : <span />}
        </div>
        <ProductImage src={variant.image || compound.image} alt={`${compound.name} ${variant.size} vial`} />
        {!supplies && bac ? (
          <div className="giftb">
            <ProductImage src={bac.image} alt="" />
            <span>{t('Free BAC Water')}<small>{t('with every order')}</small></span>
          </div>
        ) : null}
      </div>

      <div className="pinfo">
        <span className="cat-l">{shelfLabel(compound.shelf, lang)}</span>
        <h1>{h1}</h1>
        <div className="prow">
          <span className="st">★★★★★</span>
          <span>5.0 Google · 4.6 Trustpilot</span>
          <span className={`stock${variant.inStock ? '' : ' out'}`}>
            <Ms name={variant.inStock ? 'check_circle' : 'schedule'} />
            {t(variant.inStock ? 'In stock' : 'Out of stock')}
          </span>
        </div>

        <div className="big-price">
          <b className="num">{m(tot)}</b>
          <s className="num">{pct ? m(full) : ''}</s>
          {pct ? <span className="save">{t(`Save ${m(full - tot)}`)}</span> : null}
        </div>
        <div className="perline">
          {`${qty} × ${m(unit)}`}
          {pct ? ` · ${quote?.dealApplied ? `${pctLabel}% ${t('off')} · ${dealView?.name || ''}` : `${pctLabel}% ${t('bulk discount')}`}` : ''}
          {supplies ? '' : ` · ${t('+ free BAC Water')}`}
        </div>

        <div className="blk">
          <div className="lab">
            {t('Strength')} <span>{t(`${compound.variants.length} option${compound.variants.length === 1 ? '' : 's'}`)}</span>
          </div>
          <div className="psizes">
            {chips.map((entry) => (
              <button
                type="button"
                key={entry}
                className={`sz${variantFor(compound, entry)?.inStock ? '' : ' oos'}`}
                aria-pressed={entry === variant.size}
                onClick={() => setSize(entry)}
              >
                {entry}
              </button>
            ))}
            {more.length ? (
              <label className={`szmore${selectedInMore ? ' on' : ''}`}>
                <select
                  aria-label={t('More strengths')}
                  value={selectedInMore ? variant.size : ''}
                  onChange={(event) => { if (event.target.value) setSize(event.target.value); }}
                >
                  <option value="">{`${t('More')} (${more.length})`}</option>
                  {more.map((entry) => (
                    <option value={entry} key={entry}>
                      {variantFor(compound, entry)?.inStock ? entry : `${entry} · ${t('out of stock')}`}
                    </option>
                  ))}
                </select>
                <Ms name="expand_more" />
              </label>
            ) : null}
          </div>
        </div>

        <div className="blk">
          <div className="lab qlab">{t('Quantity')} <span>{t('Best discount applies automatically')}</span></div>
          {/* Hidden by the design's own `#pv.dealmode` rule while a deal runs. */}
          <div className="tiers">
            {tiers.map((tier) => (
              <button className="tier" type="button" key={tier.q} aria-pressed={qty === tier.q} onClick={() => setQtyClamped(tier.q)}>
                {tier.flag ? <span className="flag">{t(tier.flag)}</span> : null}
                <b>{tier.q}</b>
                <small>{t(tier.q > 1 ? 'vials' : 'vial')}</small>
                <em>{tier.off ? `−${tier.off}%` : ''}</em>
              </button>
            ))}
          </div>
          <div className="pdeal">
            {dealMode ? (
              <>
                <div className="pdh">
                  <Ms name="sell" />
                  <b>{dealView.name}</b>
                  <span>{quote?.dealApplied ? t(`${pctLabel}% off your whole order`) : t('Spend more, save more')}</span>
                </div>
                <div className="pdt">
                  {ladder.map((tier) => (
                    <span className={sub >= tier.at ? 'on' : ''} key={tier.minUsd}>
                      <b>{`${tier.pct}%`}</b>
                      <small>{`${m(tier.at)}+`}</small>
                    </span>
                  ))}
                </div>
                <div className="pdbar"><i style={{ width: `${top ? Math.min(100, (sub / top) * 100) : 0}%` }} /></div>
                <p className="pdm">
                  {other > 0.005 ? (
                    <>{`${t('Cart')} ${m(other)} + ${t('this')} ${m(full)} = `}<b>{m(sub)}</b>{'. '}</>
                  ) : (
                    <>{`${t('This order')}: `}<b>{m(sub)}</b>{'. '}</>
                  )}
                  {nextStep ? (
                    <>{`${t('Add')} `}<b>{m(nextStep.at - sub)}</b>{` ${t('for')} `}<b>{t(`${nextStep.pct}% off`)}</b>.</>
                  ) : <b>{t('Best discount unlocked.')}</b>}
                  {` ${t('Discount counts on the order total before discounts, not combined with volume pricing.')}`}
                </p>
              </>
            ) : null}
          </div>
          <div className="qline">
            <span>{t(dealMode ? 'Quantity' : 'Custom quantity')}</span>
            <div className="step">
              <button type="button" aria-label={t('One less')} onClick={() => setQtyClamped(qty - 1)}><Ms name="remove" /></button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="99"
                aria-label={t('Quantity')}
                value={qty}
                onChange={(event) => { if (event.target.value) setQtyClamped(event.target.value); }}
              />
              <button type="button" aria-label={t('One more')} onClick={() => setQtyClamped(qty + 1)}><Ms name="add" /></button>
            </div>
          </div>
          <div>
            {nudge ? (
              <div className="nudge">
                <Ms name="savings" />
                <span>
                  {`${t(`Add ${nudge.to - qty} more to save`)} `}<b>{`${nudge.pct}%`}</b>{` (${m(nudge.save)})`}
                </span>
                <button type="button" onClick={() => setQtyClamped(nudge.to)}>{t(`Make it ${nudge.to}`)}</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shipbar">
          <div className="t">
            <span>{progress.reached ? t('Free delivery unlocked') : t(`${m(progress.remaining)} away from free delivery`)}</span>
            <span className="muted num">{`${m(Math.min(progress.items, progress.threshold))} / ${m(progress.threshold)}`}</span>
          </div>
          <div className={`track${progress.reached ? ' done' : ''}`}>
            <i style={{ width: `${progress.percent}%` }} />
            <span className="mk"><Ms name="local_shipping" /></span>
          </div>
        </div>

        <div className="ctarow">
          {variant.inStock ? (
            <button className="btn block" type="button" onClick={addThis}>
              <Ms name="add_shopping_cart" />
              {`${t(inCart ? 'Update order' : 'Add to order')} · ${m(tot)}`}
            </button>
          ) : (
            <a
              className="btn block"
              href={whatsapp(`Hi! Please let me know when ${compound.name} ${variant.size} is back in stock.`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Ms name="notifications" />
              {t('Notify me when back')}
            </a>
          )}
        </div>

        <div className="assure">
          <span><Ms name="verified" />{t('COA on most products')}</span>
          <span><Ms name="payments" />{t('Pay cash on delivery')}</span>
          <span><Ms name="schedule" />{t('2–4 day delivery')}</span>
        </div>
        <ReviewBar reviews={reviews} lang={lang} className="rb-buy" />

        {fbtItems.length > 1 ? (
          <div className="fbt">
            <h3>{t('Frequently ordered together')}</h3>
            <div className="fbt-items">
              {fbtItems.map((item) => (
                <label className="fi" key={item.id}>
                  <input
                    type="checkbox"
                    checked={item.on}
                    disabled={item.locked}
                    onChange={(event) => setFbtOn((current) => ({ ...current, [item.id]: event.target.checked }))}
                  />
                  <span className="im"><ProductImage src={item.variant.image || item.compound.image} alt="" /></span>
                  <span className="n">
                    <b>{item.id === 'main' ? `${t('This item:')} ${item.compound.name}` : item.compound.name}</b>
                    <small>{item.id === 'bac' ? `${item.variant.size} · ${t('extra, on top of the free one')}` : item.variant.size}</small>
                  </span>
                  <span className="p num">{money(item.variant.priceCrc, item.variant.priceUsd)}</span>
                </label>
              ))}
            </div>
            <div className="fbt-foot">
              <div>
                <small className="muted">{t('Bundle total')}</small>
                <br />
                <b className="num">{m(fbtTotal)}</b>
              </div>
              <button className="btn dark sm" type="button" onClick={addSelected}>
                <Ms name="add_shopping_cart" />
                {t('Add selected')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
