import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import { DealCard } from '@/components/site/deal-bits';
import Faq from '@/components/site/faq';
import ProductGrid from '@/components/site/product-grid';
import ReviewBar from '@/components/site/review-bar';
import { dealPicks } from '@/lib/site/data';
import { REVIEWS, Reviews, CategoryTiles, Section, Steps } from '@/components/site/blocks';
import { translator } from '@/lib/storefront/i18n.mjs';
import { CONTACT, SOCIALS } from '@/lib/site/links.mjs';
import JsonLd from '@/components/site/json-ld';
import { SITE_URL } from '@/lib/indexing';
import { faqNode, organizationNode, websiteNode } from '@/lib/site/structured-data.mjs';
import WhatsAppGlyph from '@/components/storefront/whatsapp-glyph';
import { whatsappHref } from '@/lib/site/whatsapp-link.mjs';

const POPULAR_EXTRA = ['NAD+', 'BPC-157', 'Tesamorelin', 'Glutathione'];
const LATEST = ['Amino Acid Blend', 'AHK-Cu', 'VIP', 'SS-31'];

export const HOME_FAQ = [
  ['What are research peptides intended for?', 'Laboratory research only. They are not registered as pharmaceuticals in Costa Rica, and we don\'t provide dosing, protocols or medical advice.'],
  ['Do you ship outside Costa Rica?', 'No. We deliver within Costa Rica only.'],
  ['Do you offer online checkout?', 'Yes. Order on the website and pay by card, or send your order on WhatsApp.'],
  ['What payment methods do you accept?', 'SINPE Móvil, bank transfer or card.'],
  ['How do I confirm product availability?', 'Stock shows live in the catalog. We also confirm it before payment.'],
];

const OPS = [
  ['inventory_2', 'Product Information', 'Every product page lists the same fields in the same order: compound, vial size, form, molecular weight, tested purity and storage.'],
  ['lab_profile', 'Available Documentation', 'Most products have a Certificate of Analysis and specification sheet, published before sale. Find it on the product page or ask with your batch number.'],
  ['ac_unit', 'Storage & Handling', 'Products arrive lyophilised and stay at 2–8 °C from arrival to dispatch, in our own cold storage.'],
  ['local_shipping', 'Ordering & Delivery', 'Stock is live in the catalog. We confirm availability and the full total before payment, then deliver across Costa Rica in days.'],
];

/** The prototype's home page (`#home`), in the page source. */
export default function HomePage({ lang, h1, site }) {
  const t = translator(lang);
  const { compounds, categories, links, dealView, flashView } = site;
  const byName = (name) => compounds.find((compound) => compound.name === name);

  const popular = [
    ...compounds.filter((compound) => compound.best),
    ...POPULAR_EXTRA.map(byName).filter((compound) => compound && !compound.best),
  ].slice(0, 8);
  const latest = LATEST.map(byName).filter(Boolean);
  const picks = dealPicks(compounds);
  const faq = HOME_FAQ.map(([q, a]) => [t(q), t(a)]);
  const homeUrl = lang === 'es' ? '/es/' : '/';

  return (
    <>
      <JsonLd
        nodes={[
          organizationNode({ base: SITE_URL, contact: site.contact, sameAs: SOCIALS.map(([, url]) => url) }),
          websiteNode({ base: SITE_URL, lang }),
          faqNode({ base: SITE_URL, url: homeUrl, lists: [faq] }),
        ]}
      />
      <section className="hhero">
        <div className="wrap">
          <div className="hcopy">
            <span className="slogan-h">{t('Unlimited potential')}</span>
            <h1>{h1}</h1>
            <p>{t('Third-party tested, with a Certificate of Analysis on most products, stored at 2–8 °C on site, and delivered anywhere in Costa Rica in 2–4 days.')}</p>
            <div className="hctas">
              <Link className="btn" href={links.catalog}>{t('Browse the catalog')}<Ms name="arrow_forward" /></Link>
              {(dealView || flashView) ? (
                <Link className="btn ghost on-dark" href={links['deal-of-the-week']} data-deal="" data-cta="home-hero-deal">
                  <Ms name={flashView && !dealView ? 'bolt' : 'sell'} />
                  {flashView && !dealView ? (lang === 'es' ? 'Ver la oferta relámpago' : 'See the flash sale') : t('See this week\'s deals')}
                </Link>
              ) : (
                <a
                  className="btn ghost on-dark"
                  href={whatsappHref((site.contact || CONTACT).whatsapp, t('Hi! I have a question before ordering.'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cta="home-hero"
                >
                  <WhatsAppGlyph />
                  {t('Ask on WhatsApp')}
                </a>
              )}
            </div>
            <ul className="hpoints">
              <li><Ms name="verified" />{t('Verified quality')}</li>
              <li><Ms name="sell" />{t('Transparent pricing')}</li>
              <li><Ms name="location_on" />{t('Local reliability')}</li>
            </ul>
          </div>
          <div className="hside">
            <DealCard deal={dealView} picks={picks} dealHref={links['deal-of-the-week']} id="hdeal" />
            <ReviewBar reviews={site.reviews} lang={lang} className="rb-two" />
          </div>
        </div>
      </section>

      <section className="press2">
        <div className="wrap">
          <span>{t('Peptides Costa Rica was featured in')}</span>
          <span aria-label="The Tico Times article"><img src="/site/press-tico-times.webp" alt="The Tico Times" /></span>
          <span aria-label="The Costa Rica News article"><img src="/site/press-costa-rica-news.webp" alt="The Costa Rica News" /></span>
          <span aria-label="La Nación"><img src="/site/press-la-nacion.webp" alt="La Nación" /></span>
        </div>
      </section>

      <Section title={t('Shop by Category')} sub={t('Research compounds grouped by area of study.')}>
        <CategoryTiles categories={categories} t={t} />
      </Section>

      <Section title={t('Popular Products')} className="alt">
        <ProductGrid compounds={popular} id="hbest" />
        <p className="more">
          <Link className="btn dark" href={links.catalog}>
            {t(`See all ${compounds.length} compounds`)}
            <Ms name="arrow_forward" />
          </Link>
        </p>
      </Section>

      <Section title={t('How We Operate')} className="home-compact">
        <div className="ops">
          {OPS.map(([icon, title, body]) => (
            <div className="op" key={title}><span className="ms">{icon}</span><h3>{t(title)}</h3><p>{t(body)}</p></div>
          ))}
        </div>
      </Section>

      <section className="band">
        <div className="wrap">
          <div><span className="eyebrow">{t('Packaging & Delivery')}</span><h2>{t('Secure Packaging. Local Delivery.')}</h2></div>
          <Steps t={t} items={[
            ['Compound names and vial sizes', 'Clearly labelled, every vial.'],
            ['Stock confirmation before payment', 'No surprises, no backorders.'],
            ['Delivery across Costa Rica', '2–4 days, tracked, from San José.'],
          ]} />
        </div>
      </section>

      <Section title={t('Customer Success Stories')}>
        <Reviews items={REVIEWS} />
      </Section>

      <Section title={t('Latest Products')} className="alt">
        <ProductGrid compounds={latest} id="hlatest" />
      </Section>

      <Section title={t('Frequently Asked Questions')} className="home-faq">
        <Faq items={faq} />
      </Section>

      <section className="band cta">
        <div className="wrap">
          <div>
            <span className="eyebrow">{t('Bulk Savings Program')}</span>
            <h2>{t('Save 15% on 5+ vials, 20% on 10+.')}</h2>
            <p>{t('Same product, automatic, no codes.')}</p>
          </div>
          <Link className="btn" href={links.catalog}>{t('Shop the catalog')}<Ms name="arrow_forward" /></Link>
        </div>
      </section>

      <p className="disc wrap">
        <b>{t('Research use only.')}</b>{' '}
        {t('All products are supplied for laboratory research. Not for human or veterinary use.')}
      </p>
    </>
  );
}
