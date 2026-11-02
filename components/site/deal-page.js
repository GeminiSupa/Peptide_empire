import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import Faq from '@/components/site/faq';
import ProductGrid from '@/components/site/product-grid';
import { BigClock, Bundles, DealViewed, Ladder } from '@/components/site/deal-live';
import { ShopperRotating } from '@/components/site/review-widgets';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';

/**
 * The prototype's Deal of the Week page (`PAGES['deal-of-the-week']`), drawn
 * from the deal the CRM is running. With no Spend & Save deal live it says
 * so and points to the standing volume pricing instead of inventing tiers.
 */

function Head({ eyebrow, title, sub }) {
  return (
    <div className="hh">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

function endLabel(endsAt, lang) {
  try {
    return new Date(Date.parse(endsAt) - 60000).toLocaleString(lang === 'es' ? 'es-CR' : 'en-US', {
      weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
    });
  } catch {
    return '';
  }
}

export default function DealPage({ lang, site }) {
  const t = translator(lang);
  const { dealView: deal, compounds, links, exchangeRate, freeShippingLabel } = site;
  const live = Boolean(deal?.tiers?.length);
  const tiers = live ? deal.tiers : [];
  const top = tiers[tiers.length - 1];
  const named = (deal?.productNames || []).map((name) => compounds.find((compound) => compound.storedName === name || compound.name === name)).filter(Boolean);
  const picks = [...named, ...compounds.filter((compound) => compound.best && !named.includes(compound))]
    .filter((compound) => compound.shelf !== 'supplies' && compound.inStock)
    .slice(0, 8);
  const crc = (usd) => formatMoney(Math.round(usd * exchangeRate), usd, 'CRC');

  return (
    <div className="pagev" id="page">
      <section className="dlhero">
        <div className="wrap">
          <div className="dlhc">
            <nav className="bc dark" aria-label={t('Breadcrumb')}>
              <Link href={links.home}>{t('Home')}</Link>
              <span>/</span>
              <b>{t('Deal of the Week')}</b>
            </nav>
            <span className="dleb">
              <Ms name="sell" />
              {live ? `${t('This week only · ends')} ${endLabel(deal.endsAt, lang)}` : t('This week\'s deal has ended')}
            </span>
            {live ? (
              <h1>{`${deal.name}:`}<br /><em>{t(`up to ${top.pct}% off`)}</em>{` ${t('your whole order.')}`}</h1>
            ) : (
              <h1>{t('Deal of the Week')}<br /><em>{t('Volume pricing all week:')}</em>{` ${t('15% off 5+ vials, 20% off 10+.')}`}</h1>
            )}
            <p className="dllead">
              {live
                ? t('Every compound in the catalog counts. The more you stock up, the bigger the discount, applied automatically at checkout. No code needed.')
                : t('A new deal is announced every week. Until then, volume pricing applies to every order automatically.')}
            </p>
            {live && deal.endsAt ? <BigClock endsAt={deal.endsAt} /> : null}
            <div className="hctas">
              <a className="btn" href="#dlshop">{t('Shop the deal')}<Ms name="arrow_downward" /></a>
              <a className="btn ghost on-dark" href="#dlhow">{t('How it works')}</a>
            </div>
            <div className="dltrust">
              <span><b>3,400+</b>{` ${t('researchers served')}`}</span>
              <span><b>5.0</b>{` ★ Google`}</span>
              <span><b>4.8</b>{` ★ Shopper Approved`}</span>
              <span>{`${t('Delivered in')} `}<b>{t('2–4 days')}</b></span>
            </div>
          </div>
          {live ? (
            <div className="dltiers">
              {tiers.map((tier, index) => (
                <div className={`dlt${index === tiers.length - 1 ? ' best' : ''}`} key={tier.minUsd}>
                  {index === tiers.length - 1 ? <span className="dltb">{t('Best deal')}</span> : null}
                  <small>{t(`Spend ${crc(tier.minUsd)}+`)}</small>
                  <b>{`${tier.pct}%`}<i>{t('off')}</i></b>
                  <span>{t('your whole order')}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {live ? (
        <>
          <div className="dlstick"><Ladder tiers={tiers} /></div>
          <section className="pb dlb" id="dlbundles">
            <div className="wrap">
              <Head
                eyebrow={t('Fastest way to qualify')}
                title={t('One tap to each tier.')}
                sub={t('Ready-made orders built from our most-ordered compounds. Add one, then mix in anything else: everything counts toward the next tier.')}
              />
              <Bundles tiers={tiers} pool={picks} dealName={deal.name} />
            </div>
          </section>
          <DealViewed name={deal.name} />
        </>
      ) : null}

      <section className="pb alt" id="dlshop">
        <div className="wrap">
          <Head
            eyebrow={t('Shop the deal')}
            title={t('Most ordered this week.')}
            sub={t('Every product below, and every product in the catalog, counts toward your discount.')}
          />
          <ProductGrid compounds={picks} id="dlGrid" />
          <p className="dlmore">
            <Link className="btn ghost" href={links.catalog}>{t(`Browse all ${compounds.length} compounds`)}<Ms name="arrow_forward" /></Link>
          </p>
        </div>
      </section>

      <section className="pb" id="dlhow">
        <div className="wrap">
          <Head eyebrow={t('How it works')} title={t('Three steps. Nothing to remember.')} />
          <div className="dlhow">
            {[
              ['add_shopping_cart', 'Add anything', 'Mix any compounds and strengths. All of it counts toward your total.'],
              ['sell', 'The discount applies itself', 'At checkout we apply the best discount automatically: this week\'s deal or volume pricing, whichever saves you more.'],
              ['local_shipping', 'Delivered in 2–4 days', `From our cold storage in Costa Rica, with free delivery over ${freeShippingLabel}.`],
            ].map(([icon, title, body], index) => (
              <div key={title}>
                <span className="dlhn">{index + 1}</span>
                <span className="ms">{icon}</span>
                <b>{t(title)}</b>
                <p>{t(body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb alt">
        <div className="wrap">
          <div className="dlwhy">
            <div>
              <Head eyebrow={t('Why researchers stock up here')} title={t('Same lab standards. Lower price this week.')} />
              <ul className="dlchk">
                {['Third-party tested, with a Certificate of Analysis on most products', 'Stored at 2–8 °C on site until it ships', 'Local stock: no customs, no import fees', 'Pay by card, SINPE, transfer or cash on delivery'].map((line) => (
                  <li key={line}><Ms name="check_circle" />{t(line)}</li>
                ))}
              </ul>
            </div>
            <div className="dlrev"><ShopperRotating lang={lang} /></div>
          </div>
        </div>
      </section>

      <section className="pb">
        <div className="wrap">
          <Head eyebrow={t('Questions')} title={t('Before you order')} />
          <Faq items={[
            ['Which products are included?', 'All of them. Every compound and strength in the catalog counts toward your order total.'],
            ['Does it stack with the 15% / 20% volume discount?', 'No. We compare both and automatically apply whichever saves you more on your order.'],
            ['When does the deal end?', 'Sunday at 11:59 pm Costa Rica time. Orders placed before then keep the discount, even if they\'re delivered later.'],
            ['Do I need a promo code?', 'No. The discount appears in your cart as soon as your order reaches a tier.'],
            ['Can I order on WhatsApp and still get the deal?', 'Yes. The WhatsApp order message includes your discounted total, and we honour it when we confirm.'],
            ['Is this for personal use?', 'No. All products are for laboratory research use only. We don\'t provide dosing or medical advice.'],
          ].map(([q, a]) => [t(q), t(a)])}
          />
        </div>
      </section>

      <section className="dlfinal">
        <div className="wrap">
          <h2>{live ? t('Don\'t miss it. The deal ends in') : t('New deal every week')}</h2>
          {live && deal.endsAt ? <BigClock endsAt={deal.endsAt} /> : null}
          <a className="btn" href="#dlshop">{live ? t(`Shop the ${deal.name}`) : t('Shop the catalog')}<Ms name="arrow_upward" /></a>
          <p className="legal">{t('For laboratory research use only. Not for human or veterinary use.')}</p>
        </div>
      </section>
    </div>
  );
}
