import CatalogBrowser from '@/components/site/catalog-browser';
import CatalogDetails, { catalogFaq } from '@/components/site/catalog-details';
import JsonLd from '@/components/site/json-ld';
import { SITE_URL } from '@/lib/indexing';
import { collectionNodes, faqNode } from '@/lib/site/structured-data.mjs';
import { DealCard } from '@/components/site/deal-bits';
import { Reviews } from '@/components/site/blocks';
import { ShopperRotating } from '@/components/site/review-widgets';
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
 * filter rail and every compound, then customer reviews. Below them, a
 * compact guide keeps the live category names and examples without the
 * oversized explanatory copy and FAQ layout.
 *
 * `h1` is the live page's H1; `copy` its text (lib/site/live-copy.mjs).
 */
export default function CatalogPage({ lang, site, h1, copy, page }) {
  const t = translator(lang);
  const { compounds, links, dealView } = site;
  const blocks = copy?.blocks || [];
  const url = (lang === 'es' ? page?.es : page?.en) || page?.en || '/all-peptide-products-costa-rica/';

  return (
    <div id="catalog">
      <JsonLd
        nodes={[
          collectionNodes({ base: SITE_URL, url, name: h1, lang, products: compounds }),
          // The questions section is drawn only beside the live copy.
          blocks.length ? faqNode({ base: SITE_URL, url, lists: [catalogFaq(lang)] }) : null,
        ]}
      />
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

      {blocks.length ? <CatalogDetails blocks={blocks} lang={lang} /> : null}
    </div>
  );
}
