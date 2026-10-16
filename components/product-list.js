import Link from 'next/link';
import { t } from '@/lib/i18n';
import { imageSource, SIZES } from '@/lib/images';
import { localePath } from '@/lib/routes';
import { dedupeProducts } from '@/lib/dedupe-products';

/**
 * A grid of products for the category archives.
 *
 * Each card links to this site's own product page, not to the catalog — the
 * product page is where the buy action lives, so there is exactly one place a
 * visitor crosses over to the catalog site rather than several.
 *
 * Prices are a harvest snapshot; the catalog site is the authority.
 */
export default function ProductList({ products, lang, emptyLabel }) {
  const visibleProducts = dedupeProducts(products);
  if (!visibleProducts.length) {
    return emptyLabel ? <p className="mt-8 text-sm text-text-muted">{emptyLabel}</p> : null;
  }

  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {visibleProducts.map((product) => {
        const store = product.store;
        const name = store?.name ?? product.slug;
        // Resolved so an unservable image is skipped, not rendered broken.
        const image = imageSource(store?.images?.[0]);
        return (
          <li key={product.slug}>
            <Link
              className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(9,39,113,0.06)] transition duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_16px_34px_rgba(9,39,113,0.12)]"
              href={localePath(product.en, lang)}
            >
              {image.src && (
                // eslint-disable-next-line @next/next/no-img-element -- harvested
                <img
                  alt={name}
                  className="mb-4 aspect-square w-full rounded-xl bg-slate-50 p-3 object-contain"
                  loading="lazy"
                  sizes={SIZES.productCard}
                  {...image}
                />
              )}
              <h3 className="line-clamp-2 text-base font-bold leading-6 text-primary transition group-hover:text-accent">{name}</h3>
              {store?.price && (
                <p className="mt-3 text-base font-extrabold text-accent">{store.price}</p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
