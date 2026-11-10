'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Ms from '@/components/storefront/icon';
import CardBrandMarks from '@/components/storefront/payment-brand-marks';
import ProductImage from '@/components/storefront/product-image';
import WhatsAppIcon from '@/components/storefront/whatsapp-glyph';
import { cantonsIn, formatAddress, PROVINCES } from '@/lib/storefront/cr-regions.mjs';
import { freeBacWaterImage } from '@/lib/storefront/cart-display.mjs';
import { freeDeliveryProgress, freeShippingThreshold, nextTier, totalsFor } from '@/lib/storefront/cart-math.mjs';
import { deliveryProgress, usablePromo } from '@/lib/site/quote.mjs';
import { promoOrderFields } from '@/lib/site/promo.mjs';
import { clearAbandonedCart, saveAbandonedCart, whatsappOptIn } from '@/lib/site/crm.mjs';
import { countPromoEligibleUnits, minUnitsMessage } from '@/lib/catalog-pricing/promoEligibility.mjs';
import { CARD_NOTICE } from '@/lib/storefront/content.mjs';
import { canSubmitOrdersFrom } from '@/lib/storefront/catalog-origin.mjs';
import {
  BANK_CHOICES,
  CHARGEX_CHOICES,
  bankPaymentUrl,
  buildOrderPayload,
  cardPaymentUrl,
  chargexTypeFor,
  hasCustomerName,
  newOrderNumber,
  submitOrder,
} from '@/lib/storefront/order.mjs';

const STEPS = ['cart', 'details', 'pay'];
const DETAILS_KEY = 'pcr_store_details';

/** Eight digits is a Costa Rican mobile; anything else is a typo. */
function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function readDetails() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(DETAILS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

/**
 * The order sheet: basket, delivery details, payment.
 *
 * ── What happens on submit ─────────────────────────────────────────────────
 *
 * Nothing is priced or saved here. The order is posted to the catalog's
 * `/api/orders/create`, which re-prices it from the database and is the only
 * thing that decides what is charged. The six payment options are the
 * catalog checkout's own, and each continues where the catalog's does:
 *
 * - Card, Bank (ACH), Crypto: the catalog's `/pay-card` page, which opens
 *   Chargex. All three are saved as card orders, as the catalog saves them,
 *   so the catalog's "one payment at a time" lock stops a second charge.
 * - SINPE Móvil, bank transfer: the catalog's `/pay-bank` page, with the
 *   account to pay into. Shown as coming soon when staff have them off.
 * - WhatsApp: a prepared message.
 *
 * Every path saves the order FIRST. An order that exists but was never paid is
 * a lead the staff can call back; a WhatsApp message with no order behind it
 * is nothing at all.
 */
export default function CartSheet({
  open,
  onClose,
  cart,
  compounds,
  onChangeQty,
  onAdd,
  onClear,
  money,
  t,
  lang,
  currency,
  exchangeRate,
  whatsappFor,
  hrefFor,
  freeShippingLabel,
  quote = null,
  dealName = '',
  dealRunning = false,
  onPlaced = null,
  track = null,
  // Promo / affiliate codes (the new design only; see lib/site/promo.mjs).
  promo = null,
  onApplyPromo = null,
  onRemovePromo = null,
}) {
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [step, setStep] = useState('cart');
  const [ack, setAck] = useState(false);
  const [details, setDetails] = useState({
    name: '', phone: '', email: '', province: '', canton: '', district: '',
    directions: '', cedula: '', notes: '',
  });
  // Card is the primary checkout path and should never require an extra,
  // unexplained choice before the payment button becomes usable.
  const [method, setMethod] = useState('card');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [canSubmit, setCanSubmit] = useState(true);
  // SINPE and bank transfer, as switched on in the catalog admin. Off until
  // confirmed, as in the catalog.
  const [bankMethods, setBankMethods] = useState({ sinpe: false, bank_transfer: false });
  // Blocks a second click the instant the first lands: `busy` is React state
  // and updates too late to stop a fast double click placing two orders.
  const placingRef = useRef(false);
  const upsellsRef = useRef(null);

  // Card, ACH, crypto, SINPE and bank transfer leave this page with the order
  // lock still held, so nothing can place a second order while the browser is
  // navigating. Pressing Back can restore this page from the back/forward
  // cache exactly as it was left — lock included — and then every Pay button
  // silently did nothing. A restored page is a fresh visit: release the lock.
  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      placingRef.current = false;
      setBusy(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // The cart, saved to the catalog's abandoned carts once the shopper has
  // given a name, phone or email (as the catalog's checkout does), so staff
  // and the WhatsApp recovery job can follow it up. Debounced: one save per
  // pause in typing, not one per keystroke.
  const cartSavedRef = useRef(false);
  useEffect(() => {
    if (!cart.length) {
      // Emptied by hand after a save: nothing left to recover.
      if (cartSavedRef.current) clearAbandonedCart();
      cartSavedRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      if (placingRef.current) return;
      saveAbandonedCart({ cart, details, lang, currency }).then((saved) => {
        if (saved) cartSavedRef.current = true;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [cart, details.name, details.phone, details.email, lang, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = readDetails();
    if (stored && typeof stored === 'object') {
      setDetails((current) => ({ ...current, ...stored }));
    }
    setCanSubmit(canSubmitOrdersFrom(window.location.origin));
  }, []);

  // Read when the sheet loads, so the answer is in long before the payment
  // step, and again on reaching it, so a method staff just switched on or off
  // is shown as it is now. Every answer is applied: they all describe the same
  // setting, and dropping one (as a cancelled effect did) left SINPE and bank
  // transfer greyed out although they were on.
  useEffect(() => {
    if (step !== 'cart' && step !== 'pay') return;
    fetch('/api/bank-methods/', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setBankMethods({ sinpe: data.sinpe === true, bank_transfer: data.bank_transfer === true });
      })
      .catch(() => {});
  }, [step]);

  const update = (patch) => {
    setDetails((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(DETAILS_KEY, JSON.stringify(next));
      } catch {
        // Not worth interrupting checkout over.
      }
      return next;
    });
  };

  // The new design passes `quote`: checkout's pricing with the live deal, so
  // the drawer shows the total the order will be charged. Without one (the
  // older storefront), the volume-tier arithmetic.
  const totals = useMemo(() => (quote ? {
    subtotal: quote.subtotal,
    discountAmount: quote.savings,
    promoDiscount: quote.promoDiscount || 0,
    promoApplied: Boolean(quote.promoApplied),
    // The volume tier / deal share of the saving, as a percent of the subtotal.
    discountPct: Math.round(((quote.savings - (quote.promoApplied ? quote.promoDiscount || 0 : 0)) / (quote.subtotal || 1)) * 100),
    shipping: quote.shipping,
    total: quote.total,
    dealApplied: quote.dealApplied,
  } : totalsFor(cart, currency, exchangeRate)), [quote, cart, currency, exchangeRate]);
  const delivery = useMemo(
    () => (quote
      ? deliveryProgress(quote, freeShippingThreshold(currency, exchangeRate))
      : freeDeliveryProgress(cart, currency, exchangeRate)),
    [quote, cart, currency, exchangeRate],
  );
  // While a deal runs the order total decides the discount, so the per-line
  // "+N for 15% off" nudge would promise a discount that never combines.
  const tier = useMemo(() => (dealRunning ? null : nextTier(cart)), [cart, dealRunning]);

  // An empty cart has no later steps to be on.
  useEffect(() => {
    if (!cart.length) setStep('cart');
  }, [cart.length]);

  const stepIndex = STEPS.indexOf(step);
  const bacWaterImage = useMemo(() => freeBacWaterImage(compounds), [compounds]);

  const scrollUpsells = (direction) => {
    const rail = upsellsRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(300, rail.clientWidth * 0.8), behavior: 'smooth' });
  };

  const whatsappMessage = () => {
    const lines = cart.map((line) => `${line.qty} × ${line.name} ${line.size}`);
    const address = formatAddress(details);
    return [
      'Hi! I would like to place this order:',
      '',
      ...lines,
      '',
      `Total: ${money(totals.total, totals.total)}`,
      details.name ? `Name: ${details.name}` : '',
      address ? `Address: ${address}` : '',
      method === 'whatsapp' ? 'I will pay by SINPE / bank transfer.' : '',
    ].filter(Boolean).join('\n');
  };

  function validate() {
    if (!ack) return t('Please confirm the research-use statement.');
    if (!hasCustomerName(details.name)) {
      return t('Please add your name.');
    }
    if (phoneDigits(details.phone).length !== 8) {
      return t('Please add a valid WhatsApp number (8 digits).');
    }
    if (!details.province || !details.canton) {
      return t('Please choose your province and canton.');
    }
    if (!String(details.directions || '').trim()) {
      return t('Please add the exact directions to your address.');
    }
    return '';
  }

  async function place(paymentMethod) {
    if (placingRef.current) return; // an order is already being placed
    const problem = validate();
    if (problem) {
      setError(problem);
      setStep(ack ? 'details' : 'cart');
      return;
    }
    if (BANK_CHOICES.includes(paymentMethod) && !bankMethods[paymentMethod]) {
      setError(t('This payment method is not available right now. Please choose another.'));
      return;
    }

    placingRef.current = true;
    setBusy(true);
    setError('');

    const payload = buildOrderPayload({
      cart,
      customer: {
        name: details.name,
        phone: phoneDigits(details.phone),
        email: details.email,
        address: formatAddress(details),
        idNumber: details.cedula || null,
      },
      paymentMethod,
      offCardMethod: paymentMethod === 'whatsapp' ? 'sinpe' : null,
      currency,
      exchangeRate,
      lang,
      orderNumber: newOrderNumber(),
      honeypot,
      quote,
    });

    if (details.notes) {
      payload.internal_notes = `${payload.internal_notes} · ${details.notes}`;
    }
    // The code travels with the order as the catalog's checkout sends it;
    // checkout validates it again and prices with it.
    Object.assign(payload, promoOrderFields(usablePromo(promo, cart)));

    const result = await submitOrder(payload);
    setBusy(false);
    placingRef.current = false;

    if (!result.ok) {
      if (result.errorCode === 'price_increased') {
        setError(t('Prices moved while this cart was open. Please review the new total.'));
        return;
      }
      setError(result.error || t('Your order could not be saved. Please try again.'));
      return;
    }

    cartSavedRef.current = false;
    onClear();
    clearAbandonedCart();

    if (CHARGEX_CHOICES.includes(paymentMethod) && result.paymentToken) {
      // Held until the page leaves, so nothing can place a second order.
      placingRef.current = true;
      window.location.href = cardPaymentUrl(result.orderNumber, result.paymentToken, chargexTypeFor(paymentMethod));
      return;
    }

    if (BANK_CHOICES.includes(paymentMethod) && result.bankPaymentToken) {
      placingRef.current = true;
      window.location.href = bankPaymentUrl(result.bankPaymentToken, lang);
      return;
    }

    window.open(
      whatsappFor(`${whatsappMessage()}\n\nOrder: ${result.orderNumber}`),
      '_blank',
      'noopener',
    );
    setStep('cart');
    // The new design follows a WhatsApp order with its thank-you page.
    onPlaced?.({
      orderNumber: result.orderNumber,
      receiptToken: result.analyticsReceiptToken || null,
      phone: details.phone,
      lines: cart.map((line) => ({
        name: line.name,
        size: line.size,
        qty: line.qty,
        image: line.image,
        priceUsd: line.priceUsd,
        total: (currency === 'USD' ? line.priceUsd : line.priceCrc) * line.qty,
      })),
      currency,
      exchangeRate,
      shipping: totals.shipping,
      savings: totals.discountAmount,
      total: totals.total,
    });
  }

  const suggestions = useMemo(() => {
    const have = new Set(cart.map((line) => line.slug));
    return compounds
      .filter((compound) => !have.has(compound.slug) && compound.inStock)
      .sort((a, b) => (
        Number(b.shelf === 'supplies') - Number(a.shelf === 'supplies')
        || Number(b.best) - Number(a.best)
        || a.priority - b.priority
      ))
      .slice(0, 6);
  }, [cart, compounds]);

  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />

      <aside
        className={`sheet${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-hidden={!open}
      >
        <div className="grab" />

        <div className="sh-h">
          <h3 id="sheet-title">
            {step === 'cart' ? t('Your order') : step === 'details' ? t('Delivery details') : t('Payment')}
          </h3>
          <button className="icbtn" type="button" aria-label={t('Close')} onClick={onClose}>
            <Ms name="close" />
          </button>
        </div>

        <div className="sh-b">
          {!cart.length ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <Ms name="shopping_bag" style={{ fontSize: '40px' }} />
              <p style={{ marginTop: '8px' }}>{t('Your order is empty.')}</p>
            </div>
          ) : (
            <>
              <div className="costeps">
                {['Order', 'Details', 'Payment'].map((label, index) => (
                  <span
                    key={label}
                    className={index < stepIndex ? 'done' : index === stepIndex ? 'on' : ''}
                  >
                    <i>{index < stepIndex ? <Ms name="check" /> : index + 1}</i>
                    {t(label)}
                  </span>
                ))}
              </div>

              {step === 'cart' ? (
                <>
                  <div className="shipbar box" style={{ padding: '14px' }}>
                    <div className="t">
                      <span>
                        {delivery.reached
                          ? t('Free delivery unlocked')
                          : t(`${money(delivery.remaining, delivery.remaining)} away from free delivery`)}
                      </span>
                    </div>
                    <div className={`track${delivery.reached ? ' done' : ''}`}>
                      <i style={{ width: `${Math.round(delivery.percent)}%` }} />
                      <span className="mk"><Ms name="local_shipping" /></span>
                    </div>
                  </div>

                  <div className="box">
                    {cart.map((line) => (
                      <div className="line" key={line.product}>
                        <span className="im">
                          <ProductImage src={line.image} alt="" />
                        </span>
                        <div className="n">
                          <b>{line.name}</b>
                          <small>{line.size}</small>
                          {tier ? (
                            <button
                              className="nb"
                              type="button"
                              onClick={() => onChangeQty(line.product, line.qty + tier.add)}
                            >
                              {t(`+${tier.add} for ${tier.pct}% off`)}
                            </button>
                          ) : null}
                        </div>
                        <div className="rt">
                          <b className="num">
                            {money(
                              line.priceCrc * line.qty,
                              line.priceUsd * line.qty,
                            )}
                          </b>
                          <div className="step">
                            <button
                              type="button"
                              aria-label={line.qty > 1 ? t('One less') : t('Remove')}
                              onClick={() => onChangeQty(line.product, line.qty - 1)}
                            >
                              <Ms name={line.qty > 1 ? 'remove' : 'delete'} />
                            </button>
                            <input
                              className="num"
                              inputMode="numeric"
                              aria-label={t('Quantity')}
                              value={line.qty}
                              onChange={(event) => onChangeQty(line.product, event.target.value)}
                            />
                            <button type="button" aria-label={t('One more')} onClick={() => onChangeQty(line.product, line.qty + 1)}>
                              <Ms name="add" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="line gift">
                      <span className="im">
                        {bacWaterImage
                          ? <ProductImage src={bacWaterImage} alt="BAC Water 3 ml" />
                          : <Ms name="redeem" />}
                      </span>
                      <div className="n">
                        <b>BAC Water</b>
                        <small>{`3 ml · ${t('free with every order')}`}</small>
                      </div>
                      <div className="rt"><b>{t('Free')}</b></div>
                    </div>
                  </div>

                  {onApplyPromo ? (
                    <div className="box promo-box">
                      {promo ? (
                        <>
                          <div className="promo-on">
                            <Ms name="sell" filled />
                            <span>
                              <b>{promo.code}</b>
                              {` · ${Math.round(promo.discount_pct * 100)}% ${t('off')}`}
                            </span>
                            <button type="button" className="promo-x" aria-label={t('Remove code')} onClick={() => { onRemovePromo?.(); setPromoError(''); }}>
                              <Ms name="close" />
                            </button>
                          </div>
                          {(() => {
                            const units = countPromoEligibleUnits(promo, cart.map((line) => ({ product: line.product, qty: line.qty })));
                            const short = minUnitsMessage(promo, units, lang === 'en' ? 'en' : 'es');
                            if (short) return <small className="promo-note">{short}</small>;
                            if (quote && !quote.promoApplied && quote.dealApplied) {
                              return <small className="promo-note">{t('The live deal saves you more on this cart, so it is applied instead of the code.')}</small>;
                            }
                            return null;
                          })()}
                        </>
                      ) : (
                        <form
                          className="promo-form"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!promoInput.trim() || promoBusy) return;
                            setPromoBusy(true);
                            setPromoError('');
                            const reply = await onApplyPromo(promoInput);
                            setPromoBusy(false);
                            if (reply.valid || reply.pending) setPromoInput('');
                            else setPromoError(reply.error || t('That code is not valid.'));
                          }}
                        >
                          <input
                            aria-label={t('Promo code')}
                            placeholder={t('Promo or affiliate code')}
                            autoCapitalize="characters"
                            value={promoInput}
                            onChange={(event) => setPromoInput(event.target.value)}
                          />
                          <button type="submit" disabled={!promoInput.trim() || promoBusy}>
                            {promoBusy ? t('Checking…') : t('Apply code')}
                          </button>
                        </form>
                      )}
                      {promoError ? <small className="promo-err">{promoError}</small> : null}
                    </div>
                  ) : null}

                  {suggestions.length ? (
                    <div className="upsell">
                      <h4>
                        <Ms name="bolt" filled />
                        {delivery.reached
                          ? t('Researchers also add')
                          : t(`Add ${money(delivery.remaining, delivery.remaining)} for free delivery`)}
                      </h4>
                      <div className="ups-wrap">
                        <button className="ups-nav prev" type="button" aria-label={t('Previous products')} onClick={() => scrollUpsells(-1)}>
                          <Ms name="arrow_back" />
                        </button>
                        <div className="ups" ref={upsellsRef}>
                          {suggestions.map((compound) => {
                            const variant = compound.variants.find((entry) => entry.inStock)
                              || compound.variants[0];
                            return (
                              <div className="up" key={compound.slug}>
                                <a className="im" href={hrefFor(compound.slug)}>
                                  <ProductImage src={variant.image || compound.image} alt="" />
                                </a>
                                <b>{compound.name}</b>
                                <small>
                                  {[variant.size, money(variant.priceCrc, variant.priceUsd)].filter(Boolean).join(' · ')}
                                </small>
                                <button type="button" onClick={() => onAdd(compound, variant, 1)}>
                                  <Ms name="add" />
                                  {t('Add')}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <button className="ups-nav next" type="button" aria-label={t('Next products')} onClick={() => scrollUpsells(1)}>
                          <Ms name="arrow_forward" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {step === 'details' ? (
                <div className="box form">
                  <div className="fsec">{t('Contact')}</div>
                  <div className="fld">
                    <label htmlFor="co-name">{t('Name')}</label>
                    <input
                      id="co-name"
                      autoComplete="name"
                      value={details.name}
                      onChange={(event) => update({ name: event.target.value })}
                    />
                  </div>

                  <div className="fld">
                    <label htmlFor="co-phone">{t('WhatsApp number')}</label>
                    <input
                      id="co-phone"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="8888 8888"
                      value={details.phone}
                      onChange={(event) => update({ phone: event.target.value })}
                    />
                  </div>

                  <div className="fld">
                    <label htmlFor="co-email">
                      {t('Email')} <span className="muted">{t('(optional, for your receipt)')}</span>
                    </label>
                    <input
                      id="co-email"
                      type="email"
                      autoComplete="email"
                      value={details.email}
                      onChange={(event) => update({ email: event.target.value })}
                    />
                  </div>

                  <div className="fsec">{t('Delivery address')}</div>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor="co-prov">{t('Province')}</label>
                      <select
                        id="co-prov"
                        value={details.province}
                        onChange={(event) => update({ province: event.target.value, canton: '' })}
                      >
                        <option value="">{t('Choose')}</option>
                        {PROVINCES.map((province) => (
                          <option key={province} value={province}>{province}</option>
                        ))}
                      </select>
                    </div>

                    <div className="fld">
                      <label htmlFor="co-canton">{t('Canton')}</label>
                      <select
                        id="co-canton"
                        disabled={!details.province}
                        value={details.canton}
                        onChange={(event) => update({ canton: event.target.value })}
                      >
                        <option value="">{details.province ? t('Choose') : t('Province first')}</option>
                        {cantonsIn(details.province).map((canton) => (
                          <option key={canton} value={canton}>{canton}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="fld">
                    <label htmlFor="co-dist">{t('District')}</label>
                    <input
                      id="co-dist"
                      autoComplete="address-level3"
                      placeholder={t('e.g. San Rafael')}
                      value={details.district}
                      onChange={(event) => update({ district: event.target.value })}
                    />
                  </div>

                  <div className="fld">
                    <label htmlFor="co-addr">{t('Exact directions (otras señas)')}</label>
                    <textarea
                      id="co-addr"
                      rows={3}
                      autoComplete="street-address"
                      placeholder={t('e.g. 200 m norte de la iglesia, casa blanca portón negro')}
                      value={details.directions}
                      onChange={(event) => update({ directions: event.target.value })}
                    />
                  </div>

                  <div className="fsec">
                    {t('Invoice')} <span className="muted">{t('(optional)')}</span>
                  </div>
                  <div className="fld">
                    <label htmlFor="co-ced">{t('Cédula or ID for electronic invoice')}</label>
                    <input
                      id="co-ced"
                      inputMode="numeric"
                      placeholder={t("Leave blank if you don't need one")}
                      value={details.cedula}
                      onChange={(event) => update({ cedula: event.target.value })}
                    />
                  </div>

                  <div className="fld">
                    <label htmlFor="co-notes">
                      {t('Delivery notes')} <span className="muted">{t('(optional)')}</span>
                    </label>
                    <input
                      id="co-notes"
                      placeholder={t('Gate code, best time to deliver…')}
                      value={details.notes}
                      onChange={(event) => update({ notes: event.target.value })}
                    />
                  </div>

                  <label className="optin">
                    <input
                      type="checkbox"
                      checked={Boolean(details.whatsappOptIn)}
                      onChange={(event) => update({ whatsappOptIn: event.target.checked })}
                    />
                    <span>{t('Send me order updates and offers on WhatsApp')}</span>
                  </label>

                  {/* A bot fills this; a person never sees it. Checkout scores
                      it and strips the key before the insert. */}
                  <input
                    aria-hidden="true"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(event) => setHoneypot(event.target.value)}
                    style={{
                      position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0,
                    }}
                  />

                  {error ? <div className="err">{error}</div> : null}

                  <p className="muted" style={{ fontSize: '12.5px', marginTop: '10px', display: 'flex', gap: '6px' }}>
                    <Ms name="lock" style={{ fontSize: '17px' }} />
                    {t('Used only to deliver your order. We never sell or share your details.')}
                  </p>
                </div>
              ) : null}

              {step === 'pay' ? (
                <>
                  <div className="methods">
                    <button
                      className="method"
                      type="button"
                      aria-pressed={method === 'card'}
                      onClick={() => { setMethod('card'); track?.('add_payment_info', { payment_type: 'card' }); }}
                    >
                      <CardBrandMarks />
                      <b>{t('Card')}</b>
                      <small>{t('Credit/Debit · Apple Pay · Google Pay')}</small>
                    </button>
                    <button
                      className="method"
                      type="button"
                      aria-pressed={method === 'whatsapp'}
                      onClick={() => { setMethod('whatsapp'); track?.('add_payment_info', { payment_type: 'whatsapp' }); }}
                    >
                      <span className="wa-ic"><WhatsAppIcon /></span>
                      <b>WhatsApp</b>
                      <small>{t('SINPE or bank transfer')}</small>
                    </button>
                    {[
                      { value: 'sinpe', icon: 'smartphone', title: 'SINPE Móvil', detail: t('From any participating bank · CRC'), off: !bankMethods.sinpe },
                      { value: 'bank_transfer', icon: 'account_balance', title: t('Bank transfer'), detail: t('Any Costa Rican bank · CRC or USD'), off: !bankMethods.bank_transfer },
                      { value: 'ach', icon: 'account_balance_wallet', title: 'ACH', detail: t('US bank account · USD'), off: false },
                      { value: 'crypto', icon: 'currency_bitcoin', title: t('Crypto'), detail: t('Cryptocurrency · USD value'), off: false },
                    ].map((option) => (
                      <button
                        key={option.value}
                        className="method"
                        type="button"
                        aria-pressed={method === option.value}
                        disabled={option.off}
                        style={option.off ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                        onClick={() => {
                          if (option.off) return;
                          setMethod(option.value);
                          setError('');
                          track?.('add_payment_info', { payment_type: option.value });
                        }}
                      >
                        <Ms name={option.icon} />
                        <b>{option.title}</b>
                        <small>{option.off ? t('Coming soon') : option.detail}</small>
                      </button>
                    ))}
                  </div>

                  <div className="box paysum">
                    <div>
                      <span>{t('Products')}</span>
                      <span className="num">{money(totals.subtotal, totals.subtotal)}</span>
                    </div>
                    {totals.promoApplied && totals.promoDiscount > 0 ? (
                      <div>
                        <span>{`${t('Code')} ${promo?.code || ''}`}</span>
                        <span className="ok num">{`−${money(totals.promoDiscount, totals.promoDiscount)}`}</span>
                      </div>
                    ) : null}
                    {totals.discountAmount - (totals.promoApplied ? totals.promoDiscount : 0) > 0 ? (
                      <div>
                        <span>
                          {totals.dealApplied
                            ? `${totals.discountPct}% ${t('off')}${dealName ? ` · ${dealName}` : ''}`
                            : t(`${totals.discountPct}% bulk discount`)}
                        </span>
                        <span className="ok num">
                          {(() => {
                            const amount = totals.discountAmount - (totals.promoApplied ? totals.promoDiscount : 0);
                            return `−${money(amount, amount)}`;
                          })()}
                        </span>
                      </div>
                    ) : null}
                    <div>
                      <span>BAC Water 3 ml</span>
                      <span className="ok">{t('Free')}</span>
                    </div>
                    <div>
                      <span>{t('Delivery · 2–4 days')}</span>
                      <span className="num">
                        {totals.shipping
                          ? money(totals.shipping, totals.shipping)
                          : <span className="ok">{t('Free')}</span>}
                      </span>
                    </div>
                    <div className="tot">
                      <span>{t('Total')}</span>
                      <b className="num">{money(totals.total, totals.total)}</b>
                    </div>
                  </div>

                  {!canSubmit ? (
                    <div className="err" style={{ marginTop: '12px' }}>
                      {t('Orders cannot be submitted from this preview address. The catalog only accepts orders from peptidescostarica.net.')}
                    </div>
                  ) : null}

                  {method === 'card' ? (
                    <div className="cardinfo">
                      <div className="ci-h">
                        <Ms name="lock" filled />
                        <span>
                          <b>{t('Secure card payment')}</b>
                          <small>{`${t('Processed by')} ${CARD_NOTICE.processor}`}</small>
                        </span>
                      </div>
                      <ul>
                        <li>
                          <Ms name="shield_lock" />
                          <span>{t('The next page is Chargex, our card processor. You enter the card there. We never see the card number.')}</span>
                        </li>
                        <li>
                          <Ms name="currency_exchange" />
                          <span>{t('Charged in US dollars. Some banks add a 1–3% foreign-transaction fee; that fee comes from your bank, not from us.')}</span>
                        </li>
                        <li>
                          <Ms name="receipt_long" />
                          <span>{t("On your statement, the charge appears under our processor's name:")}</span>
                        </li>
                      </ul>
                      <div className="stmt">
                        <Ms name="account_balance" />
                        <div>
                          <small>{t('Card statement')}</small>
                          <b>{CARD_NOTICE.descriptor}</b>
                        </div>
                        <span className="num">USD</span>
                      </div>
                      <p className="stmt-n">
                        {t("That's us. If you have a question about the charge, message us first and we'll sort it out.")}
                      </p>
                    </div>
                  ) : method === 'ach' || method === 'crypto' ? (
                    <div className="cardinfo">
                      <div className="ci-h">
                        <Ms name="lock" filled />
                        <span>
                          <b>{method === 'ach' ? t('Bank (ACH) payment') : t('Crypto payment')}</b>
                          <small>{`${t('Processed by')} ${CARD_NOTICE.processor}`}</small>
                        </span>
                      </div>
                      <ul>
                        <li>
                          <Ms name="shield_lock" />
                          <span>
                            {method === 'ach'
                              ? t('The next page is Chargex, our payment processor. You enter your US bank account details there. We never see them.')
                              : t('The next page is Chargex, our payment processor. You send the crypto payment from there. We never handle your wallet.')}
                          </span>
                        </li>
                        <li>
                          <Ms name="info" />
                          <span>
                            {method === 'ach'
                              ? t('Bank payments can take a few business days to confirm. ACH is for US bank accounts only.')
                              : t('Your total is priced in US dollars. Chargex shows you what to send on the next page.')}
                          </span>
                        </li>
                      </ul>
                    </div>
                  ) : method === 'sinpe' || method === 'bank_transfer' ? (
                    <p className="muted" role="status" style={{ fontSize: '13.5px', margin: '14px 0 8px' }}>
                      {method === 'sinpe'
                        ? t(`Pay from any participating bank in colones: ₡${Math.round(currency === 'CRC' ? totals.total : totals.total * exchangeRate).toLocaleString('en-US')}. We will show the SINPE number after you place the order.`)
                        : t(`Transfer from any bank in ${currency}. We will show the receiving account after you place the order and confirm payment after the funds arrive.`)}
                    </p>
                  ) : method === 'whatsapp' ? (
                    <>
                      <p className="muted" style={{ fontSize: '13.5px', margin: '14px 0 8px' }}>
                        {t('This message opens in WhatsApp, ready to send. We reply with stock, your batch COA and payment details.')}
                      </p>
                      <div className="chat"><div className="bub">{whatsappMessage()}</div></div>
                    </>
                  ) : (
                    <p className="muted" style={{ fontSize: '13.5px', marginTop: '14px', textAlign: 'center' }}>
                      {t("Choose how you'd like to pay.")}
                    </p>
                  )}

                  {error ? <div className="err" style={{ marginTop: '12px' }}>{error}</div> : null}
                </>
              ) : null}
            </>
          )}
        </div>

        {cart.length ? (
          <div className="sh-f">
            {/* Sits beside the button it unlocks. Below the upsells it was
                off-screen on a phone, under a button that just looked greyed out. */}
            {step === 'cart' ? (
              <label className="ack">
                <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
                <span>
                  {t('I confirm these products are for')}{' '}
                  <b>{t('laboratory research use only')}</b>
                  {t(', not for human or animal consumption.')}
                </span>
              </label>
            ) : null}

            <div className="sum">
              {/* `totals.total` already includes delivery, so say so. */}
              <span className="sumnote">
                {totals.discountAmount > 0 ? (
                  <span className="sv">
                    {t(`You save ${money(totals.discountAmount, totals.discountAmount)}`)}
                  </span>
                ) : null}
                <span className="dl">
                  {totals.shipping > 0
                    ? t(`Incl. ${money(totals.shipping, totals.shipping)} delivery`)
                    : t('Free delivery')}
                </span>
              </span>
              <span>
                <b className="num">{money(totals.total, totals.total)}</b>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {step !== 'cart' ? (
                <button
                  className="btn ghost"
                  type="button"
                  aria-label={t('Back')}
                  style={{ width: '52px', padding: 0 }}
                  onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])}
                >
                  <Ms name="arrow_back" />
                </button>
              ) : null}

              {step === 'cart' ? (
                <button
                  className="btn block"
                  type="button"
                  disabled={!ack}
                  onClick={() => { setError(''); setStep('details'); track?.('begin_checkout'); }}
                >
                  {t('Continue to checkout')}
                  <Ms name="arrow_forward" />
                </button>
              ) : step === 'details' ? (
                <button
                  className="btn block"
                  type="button"
                  onClick={() => {
                    const problem = validate();
                    if (problem) { setError(problem); return; }
                    setError('');
                    setStep('pay');
                    track?.('add_shipping_info', { shipping_tier: 'delivery' });
                    if (details.whatsappOptIn) whatsappOptIn({ phone: details.phone, lang });
                  }}
                >
                  {t('Continue to payment')}
                  <Ms name="arrow_forward" />
                </button>
              ) : (
                <button
                  className="btn block"
                  type="button"
                  disabled={!method || busy || !canSubmit || (BANK_CHOICES.includes(method) && !bankMethods[method])}
                  onClick={() => place(method)}
                >
                  {busy ? t('Working…') : method === 'card'
                    ? `${t('Pay')} ${money(totals.total, totals.total)} ${t('by Card')}`
                    : method === 'ach'
                      ? `${t('Pay')} ${money(totals.total, totals.total)} ${t('by Bank (ACH)')}`
                      : method === 'crypto'
                        ? `${t('Pay')} ${money(totals.total, totals.total)} ${t('with Crypto')}`
                        : BANK_CHOICES.includes(method)
                          ? `${t('Place order')} · ${money(totals.total, totals.total)}`
                          : t('Send on WhatsApp')}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
