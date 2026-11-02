import Link from 'next/link';

/**
 * The prototype's small building blocks (`sec`, `steps`, `catTiles`,
 * `reviewsHTML`…), as server components so their text is in the page source.
 */

/** A home-style section: `<section class="hsec">` with its heading row. */
export function Section({ title, sub, className = '', children }) {
  return (
    <section className={`hsec ${className}`}>
      <div className="wrap">
        <div className="hh">
          <h2>{title}</h2>
          {sub ? <p>{sub}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** A numbered list of `[title, detail]` steps. */
export function Steps({ items, t = (s) => s }) {
  return (
    <ol className="steps">
      {items.map(([title, detail], index) => (
        <li key={title}><i>{index + 1}</i><b>{t(title)}</b><small>{t(detail)}</small></li>
      ))}
    </ol>
  );
}

/** Feature tiles: `[icon, title, detail]`. */
export function Features({ items, t = (s) => s }) {
  return (
    <div className="feat">
      {items.map(([icon, title, detail]) => (
        <div key={title}><span className="ms">{icon}</span><b>{t(title)}</b><small>{t(detail)}</small></div>
      ))}
    </div>
  );
}

/** Link cards: `[href, title, icon]`. */
export function LinkCards({ items, t = (s) => s }) {
  return (
    <div className="lcards">
      {items.map(([href, title, icon]) => (
        <Link href={href} key={href}>
          <span className="ms">{icon}</span>
          <b>{t(title)}</b>
          <span className="ms ar">arrow_forward</span>
        </Link>
      ))}
    </div>
  );
}

/** The category tiles, each with its first compound's photo and its count. */
export function CategoryTiles({ categories, t = (s) => s }) {
  return (
    <div className="ctiles">
      {categories.map((category) => {
        const first = category.compounds[0];
        const count = category.compounds.length;
        return (
          <Link className="ctile" href={category.href} key={category.slug}>
            <span className="cim">{first ? <img loading="lazy" src={first.image} alt="" /> : null}</span>
            <b>{t(category.name)}</b>
            <small>{t(`${count} compound${count === 1 ? '' : 's'}`)}</small>
          </Link>
        );
      })}
    </div>
  );
}

/** Verified reviews quoted on the site, each with its source. */
export const REVIEWS = [
  ['trustpilot', 'Excellent service, quality, and price. For me, they are the best in Costa Rica; I hope they never change.', 'Daniel Manzanares Quesada · Trustpilot'],
  ['trustpilot', 'Hay stock y son rápidos y asesoran muy bien, confiable los pagos y el producto llega en buen estado.', 'Botanical Cosmetic · Trustpilot'],
  ['google', 'Son excelentes, mil estrellas.', 'Lic. Juan Alfonso Mata Chavarría · Google'],
];

export function Reviews({ items = REVIEWS }) {
  return (
    <div className="revs">
      {items.map(([source, quote, who]) => (
        <div className="rev" key={who}>
          <div className="top"><img src={`/site/${source}.webp`} alt={source} /><span className="st">★★★★★</span></div>
          <q>{quote}</q>
          <div className="who">{who}</div>
        </div>
      ))}
    </div>
  );
}
