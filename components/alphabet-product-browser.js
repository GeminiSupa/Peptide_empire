'use client';

import { useState } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function ProductCard({ product, catalogHref, lang }) {
  const destination = product.href || catalogHref;
  const external = !product.href;
  return (
    <article className="product-card group/card flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(9,39,113,0.06)] transition duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_16px_34px_rgba(9,39,113,0.12)]">
      {product.href ? (
        <a className="flex flex-1 flex-col" href={product.href}>
          <CardDetails product={product} />
        </a>
      ) : (
        <div className="flex flex-1 flex-col"><CardDetails product={product} /></div>
      )}
      {product.price && <p className="mt-3 text-base font-extrabold text-accent">{product.price}</p>}
      <a className="product-card-button mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={destination} rel={external ? 'noopener noreferrer' : undefined} target={external ? '_blank' : undefined}>
        {external
          ? (lang === 'es' ? 'Ver catálogo' : 'Browse Catalog')
          : (lang === 'es' ? 'Ver producto' : 'View Product')}
      </a>
    </article>
  );
}

function CardDetails({ product }) {
  return (
    <>
      {product.image?.src && (
        // eslint-disable-next-line @next/next/no-img-element -- mirrored WordPress asset
        <img alt={product.name} className="product-card-image mb-4 aspect-square w-full rounded-xl bg-slate-50 p-3 object-contain" loading="lazy" sizes="(max-width: 640px) 76vw, (max-width: 1024px) 45vw, 270px" {...product.image} />
      )}
      {product.category && <p className="mb-1 text-[11px] leading-4 text-text-muted">{product.category}</p>}
      <h2 className="line-clamp-2 text-base font-bold leading-6 text-primary group-hover/card:text-accent">{product.name}</h2>
    </>
  );
}

export default function AlphabetProductBrowser({ featured, products, catalogHref, lang }) {
  const [letter, setLetter] = useState('popular');
  const shown = letter === 'popular'
    ? featured
    : products.filter((product) => product.name.toUpperCase().match(/[A-Z]/)?.[0] === letter);

  return (
    <div id="shop-by-product">
      <p className="mt-6 text-sm font-semibold text-primary">
        {lang === 'es' ? 'Filtrar por alfabeto' : 'Filter by Alphabet'}
      </p>
      <div aria-label={lang === 'es' ? 'Filtrar productos' : 'Filter products'} className="mt-3 flex flex-wrap gap-1.5" role="group">
        {['popular', ...LETTERS].map((value) => (
          <button
            aria-pressed={letter === value}
            className={`min-w-8 rounded-md border px-2.5 py-1.5 text-center text-xs font-bold transition ${letter === value ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-primary hover:border-primary/40 hover:bg-primary/5'}`}
            key={value}
            onClick={() => setLetter(value)}
            type="button"
          >
            {value === 'popular' ? (lang === 'es' ? 'Populares' : 'Popular') : value}
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {shown.map((product) => <ProductCard catalogHref={catalogHref} key={product.name} lang={lang} product={product} />)}
        </div>
      ) : (
        <p className="mt-8 text-sm text-text-muted">{lang === 'es' ? 'No hay productos disponibles con esta letra.' : 'No available products under this letter.'}</p>
      )}
    </div>
  );
}
