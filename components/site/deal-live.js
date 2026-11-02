'use client';

import { useEffect, useState } from 'react';
import Ms from '@/components/storefront/icon';
import ProductImage from '@/components/storefront/product-image';
import { useSite } from '@/components/site/site-provider';

/** The deal page's days / hours / minutes / seconds countdown. */
export function BigClock({ endsAt }) {
  const { t } = useSite();
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((Date.parse(endsAt) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const s = left ?? 0;
  const values = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  return (
    <div className="dlclock" aria-label={t('Time left')}>
      {['Days', 'Hrs', 'Min', 'Sec'].map((label, index) => (
        <span key={label}><b className="num">{left == null ? '00' : String(values[index]).padStart(2, '0')}</b><small>{t(label)}</small></span>
      ))}
    </div>
  );
}

/**
 * Where this visitor's cart sits on the deal's spend ladder, live. The order
 * total is the catalog's subtotal before discounts, as the deal counts it.
 */
export function Ladder({ tiers }) {
  const { t, currency, exchangeRate, quote, money } = useSite();
  const rate = currency === 'USD' ? 1 : exchangeRate;
  const m = (amount) => money(amount, amount);
  const sub = quote ? quote.subtotal : 0;
  const steps = tiers.map((tier) => ({ ...tier, at: tier.minUsd * rate }));
  const max = steps[steps.length - 1].at;
  const reached = steps.filter((step) => sub >= step.at);
  const current = reached.length ? reached[reached.length - 1].pct : 0;
  const next = steps.find((step) => sub < step.at);
  return (
    <div className="ladder">
      <div className="lhead">
        <div><small>{t('Your order')}</small><b className="num">{m(sub)}</b></div>
        <div className="lnow">
          {current ? <span className="lgot">{t(`${current}% off unlocked`)}</span> : <span className="lnone">{t('No discount yet')}</span>}
        </div>
      </div>
      <div className="ltrack">
        <i style={{ width: `${Math.min(100, (sub / max) * 100)}%` }} />
        {steps.map((step) => (
          <span className={`lstop${sub >= step.at ? ' on' : ''}`} style={{ left: `${(step.at / max) * 100}%` }} key={step.minUsd}>
            <em>{`${step.pct}%`}</em>
            <small>{m(step.at)}</small>
          </span>
        ))}
      </div>
      <p className="lmsg">
        {next ? (
          sub ? (
            <>{`${t('Add')} `}<b>{m(next.at - sub)}</b>{` ${t('more to unlock')} `}<b>{t(`${next.pct}% off`)}</b>{` ${t('your whole order.')}`}</>
          ) : (
            <>{`${t('Start with any compound.')} `}<b>{t(`${steps[0].pct}% off`)}</b>{` ${t('unlocks at')} ${m(steps[0].at)}.`}</>
          )
        ) : (
          <><b>{t('Maximum discount unlocked.')}</b>{` ${t(`Every extra vial is ${current}% off too.`)}`}</>
        )}
      </p>
    </div>
  );
}

/** Ready-made orders that land on each tier: one tap to qualify. */
export function Bundles({ tiers, pool, dealName }) {
  const { t, currency, exchangeRate, money, addToCart } = useSite();
  const rate = currency === 'USD' ? 1 : exchangeRate;
  const m = (amount) => money(amount, amount);
  if (!pool.length) return null;
  return (
    <div className="bnds">
      {tiers.map((tier, index) => {
        const compound = pool[index % pool.length];
        const variant = [...compound.variants].filter((entry) => entry.inStock).sort((a, b) => b.priceUsd - a.priceUsd)[0] || compound.variants[0];
        const unit = currency === 'USD' ? variant.priceUsd : variant.priceCrc;
        const n = Math.max(1, Math.ceil((tier.minUsd * rate) / unit));
        const full = n * unit;
        const pay = full * (1 - tier.pct / 100);
        const add = () => {
          addToCart(compound, variant, n);
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'select_promotion',
            ecommerce: {
              promotion_name: dealName,
              creative_slot: `bundle-${n}`,
              items: [{ item_id: compound.slug, item_name: compound.name, item_variant: variant.size, quantity: n }],
            },
          });
        };
        return (
          <div className="bnd" key={tier.minUsd}>
            <span className="bpct">{t(`${tier.pct}% off`)}</span>
            <a className="bim" href={compound.href} aria-label={compound.name}><ProductImage src={variant.image || compound.image} alt="" /></a>
            <a className="bname" href={compound.href}>{`${n} × ${compound.name} ${variant.size}`}</a>
            <div className="bpr"><s className="num">{m(full)}</s><b className="num">{m(pay)}</b></div>
            <small className="ok">{t(`You save ${m(full - pay)}`)}</small>
            <button className="btn sm block" type="button" onClick={add} disabled={!variant.inStock}>
              {t('Add bundle')}
              <Ms name="add_shopping_cart" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The view_promotion event, once per visit to the page. */
export function DealViewed({ name }) {
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'view_promotion', ecommerce: { promotion_name: name, items: [] } });
  }, [name]);
  return null;
}
