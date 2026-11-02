'use client';

import { useEffect, useMemo, useState } from 'react';
import Ms from '@/components/storefront/icon';
import ProductImage from '@/components/storefront/product-image';
import WhatsAppIcon from '@/components/storefront/whatsapp-glyph';
import { cantonsIn, formatAddress, PROVINCES } from '@/lib/storefront/cr-regions.mjs';
import { freeDeliveryProgress, freeShippingThreshold, nextTier, totalsFor } from '@/lib/storefront/cart-math.mjs';
import { deliveryProgress } from '@/lib/site/quote.mjs';
import { CARD_NOTICE } from '@/lib/storefront/content.mjs';
import { canSubmitOrdersFrom } from '@/lib/storefront/catalog-origin.mjs';
import {
  buildOrderPayload,
  cardPaymentUrl,
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
 * thing that decides what is charged. A card order then continues on the
 * catalog's own `/pay-card` page; a WhatsApp order opens a prepared message.
 *
 * Both paths save the order FIRST. An order that exists but was never paid is
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
}) {
  const [step, setStep] = useState('cart');
  const [ack, setAck] = useState(false);
  const [details, setDetails] = useState({
    name: '', phone: '', email: '', province: '', canton: '', district: '',
    directions: '', cedula: '', notes: '',
  });
  const [method, setMethod] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [canSubmit, setCanSubmit] = useState(true);

  useEffect(() => {
    const stored = readDetails();
    if (stored && typeof stored === 'object') {
      setDetails((current) => ({ ...current, ...stored }));
    }
    setCanSubmit(canSubmitOrdersFrom(window.location.origin));
  }, []);

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
    discountPct: Math.round(quote.discountPct * 100),
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
      method === 'whatsapp' ? 'I will pay by SINPE / transfer / cash on delivery.' : '',
    ].filter(Boolean).join('\n');
  };

  function validate() {
    if (!ack) return t('Please confirm the research-use statement.');
    if (String(details.name || '').trim().split(/\s+/).length < 2) {
      return t('Please add your full name.');
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
    const problem = validate();
    if (problem) {
      setError(problem);
      setStep(ack ? 'details' : 'cart');
      return;
    }

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
      offCardMethod: paymentMethod === 'card' ? null : 'sinpe',
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

    const result = await submitOrder(payload);
    setBusy(false);

    if (!result.ok) {
      if (result.errorCode === 'price_increased') {
        setError(t('Prices moved while this cart was open. Please review the new total.'));
        return;
      }
      setError(result.error || t('Your order could not be saved. Please try again.'));
      return;
    }

    onClear();

    if (paymentMethod === 'card' && result.paymentToken) {
      window.location.href = cardPaymentUrl(result.orderNumber, result.paymentToken);
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
                      <span className="im"><Ms name="redeem" /></span>
                      <div className="n">
                        <b>BAC Water</b>
                        <small>{`3 ml · ${t('free with every order')}`}</small>
                      </div>
                      <div className="rt"><b>{t('Free')}</b></div>
                    </div>
                  </div>

                  {suggestions.length ? (
                    <div className="upsell">
                      <h4>
                        <Ms name="bolt" filled />
                        {delivery.reached
                          ? t('Researchers also add')
                          : t(`Add ${money(delivery.remaining, delivery.remaining)} for free delivery`)}
                      </h4>
                      <div className="ups">
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
                    </div>
                  ) : null}
                </>
              ) : null}

              {step === 'details' ? (
                <div className="box form">
                  <div className="fsec">{t('Contact')}</div>
                  <div className="fld">
                    <label htmlFor="co-name">{t('Full name')}</label>
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
                      <Ms name="credit_card" />
                      <b>{t('Card')}</b>
                      <small>Visa, Mastercard, Apple Pay, Google Pay</small>
                    </button>
                    <button
                      className="method"
                      type="button"
                      aria-pressed={method === 'whatsapp'}
                      onClick={() => { setMethod('whatsapp'); track?.('add_payment_info', { payment_type: 'whatsapp' }); }}
                    >
                      <span className="wa-ic"><WhatsAppIcon /></span>
                      <b>WhatsApp</b>
                      <small>{t('SINPE, transfer or cash on delivery')}</small>
                    </button>
                  </div>

                  <div className="box paysum">
                    <div>
                      <span>{t('Products')}</span>
                      <span className="num">{money(totals.subtotal, totals.subtotal)}</span>
                    </div>
                    {totals.discountAmount > 0 ? (
                      <div>
                        <span>
                          {totals.dealApplied
                            ? `${totals.discountPct}% ${t('off')}${dealName ? ` · ${dealName}` : ''}`
                            : t(`${totals.discountPct}% bulk discount`)}
                        </span>
                        <span className="ok num">
                          {`−${money(totals.discountAmount, totals.discountAmount)}`}
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
                          <span>{t("You enter your card on Chargex's secure page. Your card number never reaches us.")}</span>
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
                  }}
                >
                  {t('Continue to payment')}
                  <Ms name="arrow_forward" />
                </button>
              ) : (
                <button
                  className="btn block"
                  type="button"
                  disabled={!method || busy || !canSubmit}
                  onClick={() => place(method)}
                >
                  {busy ? t('Working…') : method === 'card'
                    ? `${t('Pay')} ${money(totals.total, totals.total)}`
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
