import { ExternalLink } from 'lucide-react';
import { catalogUrl, ui } from '@/content/global';
import { t } from '@/lib/i18n';
import { imageSource, SIZES } from '@/lib/images';

/**
 * One product card, as it appears in every harvested product grid.
 *
 * Shared by the flat grids and the "Shop By Category" tabs so the two cannot
 * drift apart. There is no cart here and never should be — the catalog site owns
 * checkout, so every buy action leaves for it.
 *
 * The image is served as a full responsive candidate set. The harvested
 * reference is WordPress's 300x300 `woocommerce_thumbnail`, which is smaller
 * than the ~330px box this renders into and half the pixels a 2x screen wants;
 * see lib/images.js and scripts/mirror-image-sizes.mjs.
 */
export default function ProductCard({ product, lang }) {
  // Resolved, not the raw path: an image that cannot be served resolves to a
  // null src and is skipped rather than rendered as a broken image.
  const image = imageSource(product.image);

  return (
    <div className="flex h-full flex-col rounded-xl border border-primary/10 bg-white p-4 shadow-sm">
      {image.src && (
        // eslint-disable-next-line @next/next/no-img-element -- harvested asset
        <img
          alt={product.name}
          className="mb-3 aspect-square w-full rounded-lg object-cover"
          loading="lazy"
          sizes={SIZES.productCard}
          {...image}
        />
      )}
      <h2 className="text-sm font-bold text-primary">{product.name}</h2>
      {product.price && <p className="mt-1 text-sm font-semibold text-accent">{product.price}</p>}
      <a
        className="mt-auto inline-flex items-center justify-center gap-1 rounded-full bg-accent px-4 py-2 pt-2 text-xs font-bold text-white transition hover:brightness-110"
        href={catalogUrl(lang)}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t(ui, 'viewInCatalog', lang)}
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
