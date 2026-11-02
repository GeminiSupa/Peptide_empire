import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import Faq from '@/components/site/faq';
import ProductBuy from '@/components/site/product-buy';
import ProductGrid from '@/components/site/product-grid';
import { Reviews, Steps } from '@/components/site/blocks';
import CopyBlock from '@/components/site/copy-block';
import { fromPrice } from '@/lib/site/data';
import { variantFor } from '@/lib/storefront/group-products.mjs';
import { shelfLabel } from '@/lib/storefront/shelves.mjs';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import { productSchema } from '@/lib/site/product-schema.mjs';
import FACTS from '@/data/site/compound-facts.json';

const WHY = [
  ['science', 'Third-party tested', 'COA on most products'],
  ['ac_unit', 'Cold storage on site', '2–8 °C until dispatch'],
  ['local_shipping', '2–4 day delivery', 'Local stock, no customs'],
  ['autorenew', 'Replacement promise', 'Damaged or off-batch? Replaced'],
];

const ORDER_STEPS = [
  ['Choose', 'Pick the strength and quantity. Bulk discounts apply automatically.'],
  ['Checkout', 'Pay by card, or send the order on WhatsApp for SINPE, transfer or cash on delivery.'],
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
    ['How do I pay?', 'SINPE Móvil, bank transfer, card, or cash when it arrives.'],
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

  const schema = productSchema({ compound, category, shelf, variant, schemaUrl, exchangeRate });

  return (
    <div id="pv" className={`pview${dealMode ? ' dealmode' : ''}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="wrap">
        <nav className="bc" aria-label={t('Breadcrumb')}>
          <Link href={links.home}>{t('Home')}</Link>
          <span>/</span>
          {category ? <Link href={category.href}>{t(category.name)}</Link> : <Link href={links.catalog}>{t('Catalog')}</Link>}
          <span>/</span>
          <b>{compound.name}</b>
        </nav>

        <ProductBuy compound={compound} initialSize={initialSize} h1={h1} bac={bac} companion={companion} />

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
            <Faq items={questions.map(([q, a]) => [t(q), t(a)])} />
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
          <Faq items={ownFaq.map(([q, a]) => [t(q), t(a)])} />
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
