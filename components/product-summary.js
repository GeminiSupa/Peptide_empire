import { ExternalLink } from 'lucide-react';
import { catalogUrl, ui } from '@/content/global';
import { t } from '@/lib/i18n';
import { imageSource, SIZES } from '@/lib/images';

/**
 * The commerce summary at the top of a product page: image, name, price, and
 * the way out to the catalog.
 *
 * There is no cart here and there must never be one. The catalog site owns
 * checkout, payment and orders; this page is a shop window. The harvester drops
 * the WooCommerce add-to-cart widget for the same reason, so nothing downstream
 * can render a dead quantity control.
 *
 * The price is a harvest-time snapshot, which is why it is presented alongside
 * a link out rather than as a figure to transact on.
 */
export default function ProductSummary({ product, lang }) {
  const store = product.store;
  if (!store) return null;

  // Resolved so an unservable image is skipped, not rendered broken.
  const image = imageSource(store.images?.[0]);
  const label = t(ui, 'buyOnCatalog', lang);
  const priceNote = t(ui, 'priceShownIn', lang);

  return (
    <div className="grid gap-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(9,39,113,0.07)] sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-center sm:p-7">
      {image.src && (
        // eslint-disable-next-line @next/next/no-img-element -- harvested asset
        <img
          alt={store.name}
          className="aspect-square w-full rounded-xl bg-slate-50 p-4 object-contain"
          sizes={SIZES.productHero}
          {...image}
        />
      )}

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
          {store.name}
        </h1>

        {store.price && (
          <p className="mt-3 text-2xl font-bold text-accent">
            {store.price}
            {store.currency && (
              <span className="ml-2 align-middle text-xs font-medium text-text-muted">
                {priceNote} {store.currency}
              </span>
            )}
          </p>
        )}

        <a
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-md"
          href={catalogUrl(lang)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {label}
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </a>

        {store.categories?.length > 0 && (
          <p className="mt-5 text-xs text-text-muted">
            {store.categories.map((c) => c.name).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
