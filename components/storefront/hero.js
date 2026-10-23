'use client';

import Ms from '@/components/storefront/icon';
import ProductImage from '@/components/storefront/product-image';
import { FacebookMark } from '@/components/storefront/brand-marks';
import { imageUrl } from '@/lib/images';
import { HERO, PRESS, PROMISES, RATINGS, WEEKLY_DEAL } from '@/lib/storefront/content.mjs';

/**
 * The catalog hero: the claim, the bulk-deal card, the four promises, the
 * review scores and the press strip.
 *
 * Two departures from the design, both deliberate:
 *
 *   - The compound count comes from the live feed, so the headline cannot
 *     promise 48 compounds while the shop is selling 49.
 *   - The deal card has no countdown. The design ticked down to Sunday
 *     midnight, but 15% off 5+ and 20% off 10+ are the catalog's *standing*
 *     rates (`bulkDeal.mjs`), not a weekly promotion — the timed deal there
 *     lapsed in September. A clock on a permanent discount is urgency the
 *     shop would be inventing. If a real deal-of-the-week is running, the
 *     catalog's deals API is where it should be read from.
 */
export default function Hero({ t, compoundCount, picks, money, homeHref }) {
  return (
    <section className="chero">
      <div className="wrap">
        <div>
          <span className="eyebrow">
            {t(HERO.eyebrow).replace('{count}', String(compoundCount))}
          </span>
          <h1>
            {HERO.headlineLines.map((line) => (
              <span key={line}>
                {t(line)}
                <br />
              </span>
            ))}
            <em>{t(HERO.headlineEmphasis)}</em>
          </h1>
          <p>{t(HERO.body)}</p>
        </div>

        <div style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
          <div className="deal">
            <div className="dh">
              <span className="dk">
                <Ms name="sell" filled />
                {t('Bulk discount')}
              </span>
            </div>
            <b className="dtitle">{t(WEEKLY_DEAL.title)}</b>
            <div className="dtiers">
              {WEEKLY_DEAL.tiers.map((tier) => (
                <div key={tier.label}>
                  <small>{t(tier.label)}</small>
                  <b>{t(tier.off)}</b>
                </div>
              ))}
            </div>
            <p className="dnote">{t(WEEKLY_DEAL.note)}</p>

            {picks.length ? (
              <div className="dpk">
                <small>{t('Best sellers')}</small>
                <div>
                  {picks.map((compound) => (
                    <a href={`${homeHref}?p=${compound.slug}`} key={compound.slug}>
                      <span className="pim">
                        <ProductImage src={compound.image} alt="" />
                      </span>
                      <span>
                        <b>{compound.name}</b>
                        <small>{`${t('from')} ${money(compound.fromPriceCrc, compound.fromPriceUsd)}`}</small>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="promises">
            {PROMISES.map((promise) => (
              <div className="promise" key={promise.icon}>
                <Ms name={promise.icon} />
                <span>
                  <b>{t(promise.title)}</b>
                  <small>{t(promise.note)}</small>
                </span>
              </div>
            ))}
          </div>

          <div className="rates">
            {RATINGS.map((rating) => (
              <span className="rate" key={rating.platform}>
                {rating.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- mirrored asset
                  <img src={imageUrl(rating.logo)} alt={rating.platform} />
                ) : rating.mark === 'facebook' ? (
                  <FacebookMark />
                ) : null}
                <b>{rating.score}</b>
                {rating.stars ? <span className="st">★★★★★</span> : null}
              </span>
            ))}
          </div>

          <div className="press">
            <span>{t('As featured in')}</span>
            {PRESS.map((outlet) => (outlet.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- mirrored asset
              <img src={outlet.logo} alt={outlet.name} key={outlet.name} />
            ) : (
              // No logo file for this one; a wordmark chip the same height as
              // the logos beside it, rather than a third image that 404s.
              <span className="press-name" key={outlet.name}>{outlet.name}</span>
            )))}
          </div>
        </div>
      </div>
    </section>
  );
}
