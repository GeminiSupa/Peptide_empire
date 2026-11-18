import styles from '@/components/site/catalog-details.module.css';
import { brandSwap } from '@/lib/storefront/i18n.mjs';

const ICONS = ['monitoring', 'healing', 'psychology', 'auto_awesome', 'bolt', 'hub'];

const COPY = {
  en: {
    eyebrow: 'Browse by focus',
    title: 'Product categories',
    intro: 'Find the right area quickly, then compare live sizes, stock and pricing above.',
    bulkEyebrow: 'Bulk savings',
    bulkTitle: 'Save 15% on 5+ vials and 20% on 10+',
    bulkText: 'Same product, applied automatically. The best eligible offer is shown before payment.',
    faqTitle: 'Frequently asked questions',
    questions: [
      ['Do you ship outside Colombia?', 'No. We currently deliver within Colombia only.'],
      ['How do I order online?', 'Choose a product and size, add it to your cart, then continue to checkout or WhatsApp.'],
      ['What payment methods do you accept?', 'Card, SINPE Móvil and bank transfer.'],
      ['Is there a bulk discount?', 'Yes. Buy 5 or more vials of the same product for 15% off, or 10 or more for 20% off.'],
      ['How quickly do you respond?', 'We answer stock and order questions as quickly as possible during support hours.'],
    ],
  },
  es: {
    eyebrow: 'Explorar por objetivo',
    title: 'Categorías de productos',
    intro: 'Encuentre el área adecuada y compare arriba tamaños, inventario y precios en vivo.',
    bulkEyebrow: 'Ahorro por volumen',
    bulkTitle: 'Ahorre 15% en 5+ viales y 20% en 10+',
    bulkText: 'Mismo producto, aplicado automáticamente. La mejor oferta disponible aparece antes del pago.',
    faqTitle: 'Preguntas frecuentes',
    questions: [
      ['¿Hacen envíos fuera de Colombia?', 'No. Actualmente entregamos únicamente dentro de Colombia.'],
      ['¿Cómo hago un pedido en línea?', 'Elija un producto y tamaño, agréguelo al carrito y continúe al pago o a WhatsApp.'],
      ['¿Qué métodos de pago aceptan?', 'Aceptamos tarjeta, SINPE Móvil y transferencia bancaria.'],
      ['¿Hay descuento por volumen?', 'Sí. Compre 5 o más viales del mismo producto y ahorre 15%, o 10 o más y ahorre 20%.'],
      ['¿Qué tan rápido responden?', 'Respondemos preguntas de inventario y pedidos lo antes posible durante el horario de atención.'],
    ],
  },
};

export default function CatalogDetails({ blocks = [], lang = 'en', country = null }) {
  const base = COPY[lang] || COPY.en;
  const b = (value) => brandSwap(value, country);
  const copy = {
    ...base,
    eyebrow: b(base.eyebrow), title: b(base.title), intro: b(base.intro),
    bulkEyebrow: b(base.bulkEyebrow), bulkTitle: b(base.bulkTitle), bulkText: b(base.bulkText),
    faqTitle: b(base.faqTitle),
    questions: (base.questions || []).map(([q, a]) => [b(q), b(a)]),
  };
  const categoryStart = blocks.findIndex((block) => block.title === (lang === 'es' ? 'Categorías de Producto' : 'Product Categories'));
  const bulkAt = blocks.findIndex((block) => block.title === (lang === 'es' ? 'Ahorro al por mayor' : 'Bulk Savings'));
  const categories = categoryStart >= 0 && bulkAt > categoryStart
    ? blocks.slice(categoryStart + 1, bulkAt)
    : [];

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </header>

        <div className={styles.grid}>
          {categories.map((category, index) => (
            <article className={styles.card} key={category.title}>
              <span className={styles.icon} aria-hidden="true"><span className="ms">{ICONS[index] || 'science'}</span></span>
              <div>
                <h3>{b(category.title)}</h3>
                <p>{b(category.paras.at(-1))}</p>
              </div>
            </article>
          ))}
        </div>

        <aside className={styles.bulk}>
          <div className={styles.bulkLead}>
            <span className={styles.bulkIcon} aria-hidden="true"><span className="ms">percent</span></span>
            <div>
              <small>{copy.bulkEyebrow}</small>
              <h3>{copy.bulkTitle}</h3>
            </div>
          </div>
          <p>{copy.bulkText}</p>
        </aside>

        <div className={styles.faqWrap}>
          <header className={styles.faqHeading}>
            <p className={styles.eyebrow}>FAQ</p>
            <h2>{copy.faqTitle}</h2>
          </header>
          <div className={styles.faq}>
            {copy.questions.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The questions this section shows, for the page's FAQ structured data. */
export function catalogFaq(lang) {
  return (COPY[lang] || COPY.en).questions;
}
