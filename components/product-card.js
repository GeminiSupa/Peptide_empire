import Link from 'next/link';
import { catalogUrl, localePath } from '@/lib/site';

/**
 * Marketing-only product card.
 *
 * This project has no cart and no checkout — that lives on the catalog site.
 * The buy button therefore links out to catalog.peptidescostarica.net rather
 * than posting to any local endpoint. Do not add cart state here.
 */
export default function ProductCard({ product, lang = 'en' }) {
  const { name, price, slug, category, outOfStock } = product;
  const t =
    lang === 'es'
      ? { add: 'Añadir Al Carrito', out: 'AGOTADO' }
      : { add: 'Add to Cart', out: 'OUT OF STOCK' };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-100 bg-bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square bg-slate-50">
        {/* Product photography pending — awaiting original-resolution assets
            from the client rather than shipping low-quality scrapes. */}
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          {name}
        </div>
        {outOfStock && (
          <span className="absolute top-3 left-3 rounded bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
            {t.out}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {category && (
          <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">
            {category}
          </p>
        )}
        <h3 className="mt-1 text-sm font-bold">
          <Link href={localePath(slug, lang)} className="hover:text-accent">
            <span className="absolute inset-0" aria-hidden="true" />
            {name}
          </Link>
        </h3>
        <p className="mt-2 text-base font-extrabold text-primary">{price}</p>

        <a
          href={catalogUrl(lang)}
          className={`relative z-10 mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
            outOfStock
              ? 'cursor-not-allowed bg-slate-100 text-text-muted'
              : 'bg-accent text-white hover:bg-accent/90'
          }`}
          aria-disabled={outOfStock || undefined}
        >
          {outOfStock ? t.out : t.add}
        </a>
      </div>
    </div>
  );
}
