import Link from 'next/link';
import { t } from '@/lib/i18n';
import { imageSource, SIZES } from '@/lib/images';
import { localePath } from '@/lib/routes';

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
  if (!products?.length) {
    return emptyLabel ? <p className="mt-8 text-sm text-text-muted">{emptyLabel}</p> : null;
  }

  return (
    <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const store = product.store;
        const name = store?.name ?? product.slug;
        // Resolved so an unservable image is skipped, not rendered broken.
        const image = imageSource(store?.images?.[0]);
        return (
          <li key={product.slug}>
            <Link
              className="flex h-full flex-col rounded-xl border border-primary/10 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              href={localePath(product.en, lang)}
            >
              {image.src && (
                // eslint-disable-next-line @next/next/no-img-element -- harvested
                <img
                  alt={name}
                  className="mb-3 aspect-square w-full rounded-lg object-cover"
                  loading="lazy"
                  sizes={SIZES.productCard}
                  {...image}
                />
              )}
              <h3 className="text-sm font-bold text-primary">{name}</h3>
              {store?.price && (
                <p className="mt-1 text-sm font-semibold text-accent">{store.price}</p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
