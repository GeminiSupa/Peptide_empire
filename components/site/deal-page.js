import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import Faq from '@/components/site/faq';
import ProductGrid from '@/components/site/product-grid';
import { BigClock, Bundles, DealViewed, Ladder } from '@/components/site/deal-live';
import { ShopperRotating } from '@/components/site/review-widgets';
import ShopperApprovedLogo from '@/components/site/shopper-approved-logo';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import Breadcrumbs from '@/components/site/breadcrumbs';
import JsonLd from '@/components/site/json-ld';
import { SITE_URL } from '@/lib/indexing';
import { faqNode } from '@/lib/site/structured-data.mjs';
import { NEW_PAGES } from '@/lib/site/links.mjs';
import { flashCoversProduct } from '@/lib/site/deal-view.mjs';

const DEAL_FAQ = [
  ['Which products are included?', 'All of them. Every compound and strength in the catalog counts toward your order total.'],
  ['Does it stack with the 15% / 20% volume discount?', 'No. We compare both and automatically apply whichever saves you more on your order.'],
  ['When does the deal end?', 'Sunday at 11:59 pm Costa Rica time. Orders placed before then keep the discount, even if they\'re delivered later.'],
  ['Do I need a promo code?', 'No. The discount appears in your cart as soon as your order reaches a tier.'],
  ['Can I order on WhatsApp and still get the deal?', 'Yes. The WhatsApp order message includes your discounted total, and we honour it when we confirm.'],
  ['Is this for personal use?', 'No. All products are for laboratory research use only. We don\'t provide dosing or medical advice.'],
];

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
  const { dealView: deal, flashView: flash, compounds, links, exchangeRate, freeShippingLabel } = site;
  const live = Boolean(deal?.tiers?.length);
  // With no Deal of the Week running, a live flash sale is what the page leads
  // with — titled "Flash Sale", with a red countdown, over the products it
  // covers. A weekly deal always keeps the page's identity when both run.
  const flashOnly = !deal && Boolean(flash);
  const tiers = live ? deal.tiers : [];
  const top = tiers[tiers.length - 1];
  const leadNames = flashOnly ? (flash.productNames || []) : (deal?.productNames || []);
  // A flash lists sized product names ("Tirzepatide 10mg"), so match them
  // against each compound's variant products — matching the compound name left
  // the grid empty. The weekly deal names whole compounds, so it keeps its match.
  const named = flashOnly
    ? compounds.filter((compound) => flashCoversProduct(flash, (compound.variants || []).map((variant) => variant.product)))
    : leadNames.map((name) => compounds.find((compound) => compound.storedName === name || compound.name === name)).filter(Boolean);
  const picks = (flashOnly ? named : [...named, ...compounds.filter((compound) => compound.best && !named.includes(compound))])
    .filter((compound) => compound.shelf !== 'supplies' && compound.inStock)
    .slice(0, 8);
  const crc = (usd) => formatMoney(Math.round(usd * exchangeRate), usd, 'CRC');
  const url = NEW_PAGES['deal-of-the-week'][lang === 'es' ? 'es' : 'en'];
  // A flash sale answers differently from the weekly deal: it covers only the
  // products it names, ends at its own time (not Sunday), and has no spend
  // tier. These answers are bilingual inline so Spanish never falls back to
  // English, and they also back the page's FAQ structured data.
  const es = lang === 'es';
  const flashFaq = flash ? [
    [es ? '¿Qué productos están incluidos?' : 'Which products are included?',
      es ? 'Solo los productos de la oferta relámpago, que se muestran abajo. El resto del catálogo mantiene su precio habitual.'
        : 'Only the products in the flash sale, shown below. The rest of the catalog stays at its usual price.'],
    [es ? '¿Se combina con el descuento por volumen (15 % / 20 %)?' : 'Does it stack with the 15% / 20% volume discount?',
      es ? 'No. Comparamos ambos y aplicamos automáticamente el que más te ahorre. La oferta relámpago ya supera el precio por volumen.'
        : 'No. We compare both and apply whichever saves you more automatically. The flash price already beats volume pricing.'],
    [es ? '¿Cuándo termina la oferta relámpago?' : 'When does the flash sale end?',
      es ? `El ${endLabel(flash.endsAt, lang)}, hora de Costa Rica. Los pedidos hechos antes conservan el descuento.`
        : `${endLabel(flash.endsAt, lang)} Costa Rica time. Orders placed before then keep the discount.`],
    [es ? '¿Necesito un código?' : 'Do I need a promo code?',
      es ? 'No. El precio relámpago aparece solo en tu carrito, en los productos de la oferta.'
        : 'No. The flash price appears in your cart automatically, on the products in the sale.'],
    [es ? '¿Puedo pedir por WhatsApp y recibir el descuento?' : 'Can I order on WhatsApp and still get the discount?',
      es ? 'Sí. El mensaje de pedido por WhatsApp incluye tu total con descuento y lo respetamos al confirmar.'
        : 'Yes. The WhatsApp order message includes your discounted total, and we honour it when we confirm.'],
    [es ? '¿Es para uso personal?' : 'Is this for personal use?',
      es ? 'No. Todos los productos son solo para uso en investigación de laboratorio. No damos asesoría de dosis ni médica.'
        : 'No. All products are for laboratory research use only. We don\'t provide dosing or medical advice.'],
  ] : null;
  const faq = (flashOnly && flashFaq) ? flashFaq : DEAL_FAQ.map(([q, a]) => [t(q), t(a)]);

  return (
    <div className="pagev" id="page">
      <JsonLd nodes={[faqNode({ base: SITE_URL, url, lists: [faq] })]} />
      <section className="dlhero">
        <div className="wrap">
          <div className="dlhc">
            <Breadcrumbs
              dark
              label={t('Breadcrumb')}
              url={url}
              items={[{ name: t('Home'), href: links.home }, { name: flashOnly ? flash.name : t('Deal of the Week') }]}
            />
            <span className={`dleb${flashOnly ? ' flash' : ''}`}>
              <Ms name={flashOnly ? 'bolt' : 'sell'} />
              {live
                ? `${t('This week only · ends')} ${endLabel(deal.endsAt, lang)}`
                : flashOnly
                  ? `${t('Flash sale · ends')} ${endLabel(flash.endsAt, lang)}`
                  : t('This week\'s deal has ended')}
            </span>
            {live ? (
              <h1>{`${deal.name}:`}<br /><em>{t(`up to ${top.pct}% off`)}</em>{` ${t('your whole order.')}`}</h1>
            ) : flashOnly ? (
              <h1>{`${flash.name}:`}<br /><em>{t(`up to ${flash.pct}% off`)}</em>{` ${t('selected products.')}`}</h1>
            ) : (
              <h1>{t('Deal of the Week')}<br /><em>{t('Volume pricing all week:')}</em>{` ${t('15% off 5+ vials, 20% off 10+.')}`}</h1>
            )}
            <p className="dllead">
              {live
                ? t('Every compound in the catalog counts. The more you stock up, the bigger the discount, applied automatically at checkout. No code needed.')
                : flashOnly
                  ? t('A limited-time flash sale on the products below. The discount is applied automatically at checkout — no code needed, and it already beats volume pricing.')
                  : t('A new deal is announced every week. Until then, volume pricing applies to every order automatically.')}
            </p>
            {live && deal.endsAt ? <BigClock endsAt={deal.endsAt} /> : flashOnly && flash.endsAt ? <BigClock endsAt={flash.endsAt} red /> : null}
            <div className="hctas">
              <a className="btn" href="#dlshop">{t('Shop the deal')}<Ms name="arrow_downward" /></a>
              <a className="btn ghost on-dark" href="#dlhow">{t('How it works')}</a>
            </div>
            <div className="dltrust">
              <span><b>3,400+</b>{` ${t('researchers served')}`}</span>
              <span><b>5.0</b>{` ★ Google`}</span>
              <span><ShopperApprovedLogo width={70} /></span>
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
            eyebrow={flashOnly ? t('On sale now') : t('Shop the deal')}
            title={flashOnly ? t('In the flash sale.') : t('Most ordered this week.')}
            sub={flashOnly
              ? t('These products are discounted while the flash sale runs. The price below is what checkout charges.')
              : t('Every product below, and every product in the catalog, counts toward your discount.')}
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
            {(flashOnly ? [
              ['bolt', es ? 'Elige los productos en oferta' : 'Pick the sale products',
                es ? 'Los productos de la oferta relámpago, marcados abajo, llevan el descuento. El resto del catálogo mantiene su precio.'
                  : 'The products in the flash sale, shown below, carry the discount. The rest of the catalog keeps its usual price.'],
              ['sell', es ? 'El precio relámpago se aplica solo' : 'The flash price applies itself',
                es ? 'Al pagar cobramos el precio relámpago en esos productos — sin código, y ya supera el precio por volumen.'
                  : 'At checkout we charge the flash price on those products — no code, and it already beats volume pricing.'],
              ['local_shipping', es ? 'Entrega en 2–4 días' : 'Delivered in 2–4 days',
                es ? `Desde nuestra cadena de frío en Costa Rica, con envío gratis desde ${freeShippingLabel}.`
                  : `From our cold storage in Costa Rica, with free delivery over ${freeShippingLabel}.`],
            ] : [
              ['add_shopping_cart', 'Add anything', 'Mix any compounds and strengths. All of it counts toward your total.'],
              ['sell', 'The discount applies itself', 'At checkout we apply the best discount automatically: this week\'s deal or volume pricing, whichever saves you more.'],
              ['local_shipping', 'Delivered in 2–4 days', `From our cold storage in Costa Rica, with free delivery over ${freeShippingLabel}.`],
            ]).map(([icon, title, body], index) => (
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
                {['Third-party tested, with a Certificate of Analysis on most products', 'Stored at 2–8 °C on site until it ships', 'Local stock: no customs, no import fees', 'Pay by card, SINPE or bank transfer'].map((line) => (
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
          <Faq items={faq} />
        </div>
      </section>

      <section className="dlfinal">
        <div className="wrap">
          <h2>{live ? t('Don\'t miss it. The deal ends in') : flashOnly ? t('Don\'t miss it. The flash sale ends in') : t('New deal every week')}</h2>
          {live && deal.endsAt ? <BigClock endsAt={deal.endsAt} /> : flashOnly && flash.endsAt ? <BigClock endsAt={flash.endsAt} red /> : null}
          <a className="btn" href="#dlshop">{live ? t(`Shop the ${deal.name}`) : flashOnly ? t(`Shop the ${flash.name}`) : t('Shop the catalog')}<Ms name="arrow_upward" /></a>
          <p className="legal">{t('For laboratory research use only. Not for human or veterinary use.')}</p>
        </div>
      </section>
    </div>
  );
}
