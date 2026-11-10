import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import Faq from '@/components/site/faq';
import ProductBuy from '@/components/site/product-buy';
import ProductGrid from '@/components/site/product-grid';
import { Reviews, Steps } from '@/components/site/blocks';
import CopyBlock from '@/components/site/copy-block';
import CustomerReviews from '@/components/site/customer-reviews';
import { fromPrice } from '@/lib/site/data';
import { variantFor } from '@/lib/storefront/group-products.mjs';
import { shelfLabel } from '@/lib/storefront/shelves.mjs';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import { productSchema } from '@/lib/site/product-schema.mjs';
import Breadcrumbs from '@/components/site/breadcrumbs';
import JsonLd from '@/components/site/json-ld';
import { faqNode, plainText } from '@/lib/site/structured-data.mjs';
import { SITE_URL } from '@/lib/indexing';
import FACTS from '@/data/site/compound-facts.json';

const WHY = [
  ['science', 'Third-party tested', 'COA on most products'],
  ['ac_unit', 'Cold storage on site', '2–8 °C until dispatch'],
  ['local_shipping', '2–4 day delivery', 'Local stock, no customs'],
  ['autorenew', 'Replacement promise', 'Damaged or off-batch? Replaced'],
];

const ORDER_STEPS = [
  ['Choose', 'Pick the strength and quantity. Bulk discounts apply automatically.'],
  ['Checkout', 'Pay by card, or send the order on WhatsApp for SINPE or bank transfer.'],
  ['Receive', 'Delivered in 2–4 days with your batch COA.'],
];

/** The compounds sold beside this one: same shelf, in stock. */
function related(compound, compounds, n) {
  return compounds
    .filter((entry) => entry.slug !== compound.slug && entry.shelf === compound.shelf && entry.inStock)
    .slice(0, n);
}

/**
 * The prototype's product view (`#pv`), for a lander or a vial page.
 *
 * `h1` is the live page's own H1. `copy` is the live page's text
 * (lib/site/live-copy.mjs), which fills the description, the "why
 * researchers choose" tiles and the FAQ in place of the prototype's
 * placeholders. `initialSize` preselects a strength on a vial page.
 */
export default function ProductPage({ lang, site, compound, h1, copy, initialSize = null, schemaUrl }) {
  const t = translator(lang);
  const { compounds, categories, links, dealView, exchangeRate, freeShippingLabel } = site;
  const dealMode = Boolean(dealView?.tiers?.length);
  const category = categories.find((entry) => entry.compounds.some((member) => member.slug === compound.slug));
  const shelf = shelfLabel(compound.shelf, lang);
  const variant = variantFor(compound, initialSize || compound.defaultSize);

  const bacCompound = compounds.find((entry) => entry.slug === 'bac-water');
  const bac = bacCompound ? {
    compound: bacCompound,
    variant: variantFor(bacCompound, '10 ml'),
    image: variantFor(bacCompound, '3 ml')?.image || bacCompound.image,
  } : null;
  const near = related(compound, compounds, 10);
  const pick = near.find((entry) => entry.best) || near[0];
  const companion = pick ? { compound: pick, variant: variantFor(pick, pick.defaultSize) } : null;
  const more = related(compound, compounds, 4);

  const sizes = compound.variants.map((entry) => entry.size).filter(Boolean);
  const specs = [
    ['Form', compound.liquid ? 'Liquid, ready to use' : 'Lyophilized powder'],
    ['Strengths', sizes.join(' · ')],
    ['Category', shelf],
    ['Storage', '2–8 °C, away from light'],
    ...(compound.coa ? [['Documentation', 'COA published']] : []),
    ...(FACTS[compound.name] || []),
  ];

  const from = fromPrice(compound);
  const fromLabel = formatMoney(from.crc, from.usd, 'CRC');
  const questions = [
    ['What\'s in the vial?', 'The compound and amount on the label, as lyophilized powder (or ready-to-use liquid for blends and waters). Most products have a Certificate of Analysis confirming identity and purity.'],
    ['How fast is delivery?', '2–4 business days anywhere in Costa Rica, tracked, from our own cold storage. No customs or import fees.'],
    ['How do I pay?', 'Card, SINPE Móvil or bank transfer.'],
    ['What discounts are there?', `15% off 5+ vials of the same product, 20% off 10+. The best discount applies automatically. Every order includes a free BAC Water 3 ml, and delivery is free over ${freeShippingLabel}.`],
    ['Is this for personal use?', 'No. All products are for laboratory research use only. We don\'t provide dosing or medical advice.'],
  ];
  const ownFaq = copy?.faq?.length ? copy.faq : [
    [`What is ${compound.name}?`, `Supplied as ${compound.liquid ? 'a ready-to-use liquid' : 'lyophilised powder'} for laboratory research, with a batch Certificate of Analysis.`],
    [`How much does ${compound.name} cost in Costa Rica?`, `From ${fromLabel} per vial. 15% off 5+ vials, 20% off 10+.`],
    ['What vial sizes are available?', `${sizes.join(', ')}.`],
    ['How should it be stored?', 'At 2–8 °C, away from light. We keep it refrigerated on site until dispatch.'],
    ['Is there a Certificate of Analysis?', 'Yes, for most products. Ask for the COA of your batch or find it in the COA database.'],
    ['How fast is delivery?', '2–4 business days anywhere in Costa Rica.'],
    ['Do you provide dosing information?', 'No. Products are for laboratory research only, and we don\'t provide dosing or medical advice.'],
  ];

  // The live copy's opening paragraph and its "Description" tab read as one
  // description; every other block keeps its own heading.
  const blocks = copy?.blocks || [];
  const descIndex = blocks.findIndex((block) => /^descripci[oó]n$|^description$/i.test(block.title));
  const intro = blocks.filter((block, index) => !block.title || index === descIndex);
  // The FAQ is drawn once, as "<compound> FAQ", so blocks drop theirs.
  const rest = blocks
    .filter((block, index) => block.title && index !== descIndex)
    .map((block) => ({ ...block, faq: [] }))
    .filter((block) => block.paras.length || block.items.length || block.links.length);
  const description = intro.length ? {
    title: '',
    paras: intro.flatMap((block) => block.paras),
    items: intro.flatMap((block) => block.items),
    links: intro.flatMap((block) => block.links),
  } : null;

  // The two accordions as shown, translated once for the page and its schema.
  const shownQuestions = questions.map(([q, a]) => [t(q), t(a)]);
  const shownFaq = ownFaq.map(([q, a]) => [t(q), t(a)]);
  const descriptionText = plainText(description?.paras?.join(' ')).slice(0, 5000) || undefined;
  const { '@context': _context, ...product } = productSchema({
    compound, category, shelf, variant, schemaUrl, exchangeRate, description: descriptionText,
  });

  return (
    <div id="pv" className={`pview${dealMode ? ' dealmode' : ''}`}>
      <JsonLd nodes={[product, faqNode({ base: SITE_URL, url: schemaUrl, lists: [shownQuestions, shownFaq] })]} />
      <div className="wrap">
        <Breadcrumbs
          label={t('Breadcrumb')}
          url={schemaUrl}
          items={[
            { name: t('Home'), href: links.home },
            category ? { name: t(category.name), href: category.href } : { name: t('Catalog'), href: links.catalog },
            { name: compound.name },
          ]}
        />

        <ProductBuy compound={compound} initialSize={initialSize} h1={h1} bac={bac} companion={companion} reviews={site.reviews} />

        <div className="twocol">
          <section className="psec">
            <h2>{t('Specifications')}</h2>
            <div className="specs">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <span>{t(label)}</span>
                  <span>
                    {label === 'Documentation' && compound.coa
                      ? <a href={compound.coa} target="_blank" rel="noopener noreferrer">{t(value)}</a>
                      : t(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="psec">
            <h2>{t('Questions')}</h2>
            <Faq items={shownQuestions} />
          </section>
        </div>

        <section className="psec">
          <h2>{t('Why order from us')}</h2>
          <div className="why">
            {WHY.map(([icon, title, note]) => (
              <div key={title}><span className="ms">{icon}</span><b>{t(title)}</b><small>{t(note)}</small></div>
            ))}
          </div>
        </section>

        <section className="psec">
          <h2>{t('What people say')}</h2>
          <CustomerReviews compound={compound} t={t} />
          <Reviews />
        </section>

        {more.length ? (
          <section className="psec">
            <h2>{t(`More in ${shelf}`)}</h2>
            <ProductGrid compounds={more} className="related grid" />
          </section>
        ) : null}

        <p className="disc">
          <b>{t('Research use only.')}</b>
          {` ${t('Supplied for laboratory research. Not for human or veterinary use. We do not provide dosing or medical advice.')}`}
        </p>
      </div>

      <div className="wrap">
        {description ? (
          <CopyBlock block={description} heading={<h2 className="ptitle2">{t('Description')}</h2>} t={t} lang={lang} />
        ) : null}
        {rest.map((block) => <CopyBlock block={block} t={t} lang={lang} key={block.title} />)}

        <section className="psec">
          <h2>{t('How to order')}</h2>
          <Steps items={ORDER_STEPS} t={t} />
        </section>

        <section className="psec">
          <h2>{t(`${compound.name} FAQ`)}</h2>
          <Faq items={shownFaq} />
        </section>

        <p className="more">
          <Link className="btn dark" href={links.catalog}>
            {t('All compounds')}
            <Ms name="arrow_forward" />
          </Link>
        </p>
      </div>
    </div>
  );
}
