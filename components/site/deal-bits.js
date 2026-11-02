'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Ms from '@/components/storefront/icon';
import { useSite } from '@/components/site/site-provider';
import { timeLeft } from '@/lib/site/deal-view.mjs';

/**
 * "13h 41m" until the deal ends, ticking every 30 seconds.
 *
 * Rendered empty on the server and filled after mount: the server's clock and
 * the visitor's differ, and a countdown that disagreed between the two would
 * be a hydration mismatch on every page.
 */
export function DealClock({ endsAt }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => setLabel(timeLeft(endsAt));
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return <>{label}</>;
}

/**
 * The hero's deal card: the weekly deal's spend ladder when one runs, the
 * standing volume pricing when none does. The thresholds are stored in
 * dollars and shown in the shopper's currency at the catalog's rate.
 */
export function DealCard({ deal, picks, dealHref, id }) {
  const { t, money } = useSite();
  const { exchangeRate } = useSite();

  if (!deal) {
    return (
      <div className="deal" id={id}>
        <div className="dh"><span className="dk"><Ms name="bolt" filled />{t('Volume pricing')}</span></div>
        <b className="dtitle">{t('Stock up, save more')}</b>
        <div className="dtiers t2">
          <div><small>{t('5+ vials')}</small><b>{t('15% off')}</b></div>
          <div><small>{t('10+ vials')}</small><b>{t('20% off')}</b></div>
        </div>
        <p className="dnote">{t('Any compound · applied automatically in your order')}</p>
      </div>
    );
  }

  return (
    <div className="deal" id={id}>
      <div className="dh">
        <span className="dk"><Ms name="sell" />{t('Deal of the week')}</span>
        <span className="dt" data-dealclock="">{t('Ends in')} <b className="num"><DealClock endsAt={deal.endsAt} /></b></span>
      </div>
      <b className="dtitle">{deal.name}</b>
      <p className="dsub">{deal.headline}</p>
      {deal.tiers.length ? (
        <div className={`dtiers t${deal.tiers.length}`}>
          {deal.tiers.map((tier) => (
            <div key={tier.minUsd}>
              <small>{t(`Spend ${money(tier.minUsd * exchangeRate, tier.minUsd)}+`)}</small>
              <b>{t(`${tier.pct}% off`)}</b>
            </div>
          ))}
        </div>
      ) : (
        <ul className="dnote">{deal.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      )}
      <p className="dnote">{deal.note}</p>
      <Link className="btn block dcta" href={dealHref} data-deal="" data-cta="deal-card">
        {t(`Shop the ${deal.name}`)}
        <Ms name="arrow_forward" />
      </Link>
      {picks?.length ? (
        <div className="dpk">
          <small>{t('Most ordered this week')}</small>
          <div>
            {picks.map((pick) => (
              <Link key={pick.href} href={pick.href}>
                <span className="pim"><img src={pick.image} alt="" /></span>
                <span><b>{pick.name}</b><small>{t(`from ${money(pick.fromCrc, pick.fromUsd)}`)}</small></span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
