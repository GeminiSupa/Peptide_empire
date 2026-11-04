import CatalogBrowser from '@/components/site/catalog-browser';
import CopyBlock from '@/components/site/copy-block';
import { DealCard } from '@/components/site/deal-bits';
import { Reviews } from '@/components/site/blocks';
import { RatingBadges, ShopperRotating } from '@/components/site/review-widgets';
import { dealPicks } from '@/lib/site/data';
import { translator } from '@/lib/storefront/i18n.mjs';

const PROMISES = [
  ['verified', 'Batch COA', 'Third-party tested'],
  ['ac_unit', '2–8 °C', 'Cold storage on site'],
  ['local_shipping', '2–4 days', 'No customs'],
  ['payments', 'Cash on delivery', 'Or SINPE, card'],
];

/**
 * The prototype's catalog view (`#catalog`): hero with the deal card, the
 * filter rail and every compound, then customer reviews. Below them, the
 * live page's own copy and FAQ, so the URL keeps the words it ranks for.
 *
 * `h1` is the live page's H1; `copy` its text (lib/site/live-copy.mjs).
 */
export default function CatalogPage({ lang, site, h1, copy }) {
  const t = translator(lang);
  const { compounds, links, dealView } = site;
  const blocks = copy?.blocks || [];

  return (
    <div id="catalog">
      <section className="chero">
        <div className="wrap">
          <div>
            <span className="eyebrow">{t(`Catalog · ${compounds.length} research compounds in stock`)}</span>
            <h1>{h1}</h1>
            <p>{t('Third-party tested, with a Certificate of Analysis on most products, kept at 2–8 °C on site. Up to 20% off in bulk, and a free BAC Water with every order.')}</p>
          </div>
          <div style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
            <DealCard deal={dealView} picks={dealPicks(compounds)} dealHref={links['deal-of-the-week']} id="deal" />
            <div className="promises">
              {PROMISES.map(([icon, title, note]) => (
                <div className="promise" key={title}>
                  <span className="ms" aria-hidden="true">{icon}</span>
                  <span><b>{t(title)}</b><small>{t(note)}</small></span>
                </div>
              ))}
            </div>
            <RatingBadges lang={lang} />
            <div className="press">
              {t('As featured in')}
              {' '}
              <img src="/site/press-tico-times.webp" alt="The Tico Times" />
              <img className="t" src="/site/press-costa-rica-news.webp" alt="The Costa Rica News" />
              <img src="/site/press-la-nacion.webp" alt="La Nación" />
            </div>
          </div>
        </div>
      </section>

      <CatalogBrowser compounds={compounds} />

      <section className="catrevs">
        <div className="wrap">
          <h2>{t('What customers say')}</h2>
          <p className="muted">{t('Real reviews from verified buyers, Google and Trustpilot.')}</p>
          <ShopperRotating lang={lang} />
          <Reviews />
        </div>
      </section>

      {blocks.length ? (
        <div className="wrap">
          {blocks.map((block) => <CopyBlock block={block} t={t} lang={lang} key={block.title || block.paras[0]} />)}
        </div>
      ) : null}
    </div>
  );
}
