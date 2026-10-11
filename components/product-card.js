import Link from 'next/link';
import { catalogUrl, ui } from '@/content/global';
import { byEnglishSlug } from '@/content/pages/products';
import { t } from '@/lib/i18n';
import { imageSource, SIZES } from '@/lib/images';
import { localePath } from '@/lib/routes';

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

/** `/product/bpc-157-10mg/` -> `bpc-157-10mg`. */
const segment = (path) =>
  String(path || '')
    .replace(/^\/|\/$/g, '')
    .split('/')
    .pop();

export default function ProductCard({ product, lang }) {
  // Resolved, not the raw path: an image that cannot be served resolves to a
  // null src and is skipped rather than rendered as a broken image.
  const image = imageSource(product.image);

  /**
   * The product's own page on THIS site.
   *
   * The harvest captured `href` for every card and it was being ignored, so all
   * 68 cards on /all-peptide-products-costa-rica/ — and every other harvested
   * grid — sent the visitor straight off to the catalog. The live site links
   * each card to /product/<slug>/, and components/product-list.js already
   * states the rule these grids were quietly breaking: the product page is
   * where the buy action lives, so there is exactly ONE place a visitor crosses
   * over to the catalog rather than several.
   *
   * Resolved against the harvested products rather than trusted: the live store
   * still lists items whose product page has since 404'd (bac-water-2ml), and
   * linking to a page this build does not generate would be a dead internal
   * link. Those cards simply do not link.
   */
  const own = product.href && byEnglishSlug(segment(product.href)) ? product.href : null;

  const media = image.src && (
    // eslint-disable-next-line @next/next/no-img-element -- harvested asset
    <img
      alt={product.name}
      className="mb-4 aspect-square w-full rounded-xl bg-slate-50 p-3 object-contain"
      loading="lazy"
      sizes={SIZES.productCard}
      {...image}
    />
  );

  const details = (
    <>
      {media}
      {product.category && (
        <p className="mb-1 text-[11px] leading-4 text-text-muted">{product.category}</p>
      )}
      <h2 className="line-clamp-2 text-base font-bold leading-6 text-primary group-hover/card:text-accent">{product.name}</h2>
    </>
  );

  return (
    <article className="group/card flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(9,39,113,0.06)] transition duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_16px_34px_rgba(9,39,113,0.12)]">
      {own ? (
        <Link className="flex flex-1 flex-col" href={localePath(own, lang)}>
          {details}
        </Link>
      ) : (
        <div>{details}</div>
      )}
      {product.price && <p className="mt-3 text-base font-extrabold text-accent">{product.price}</p>}
      <a
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href={catalogUrl(lang)}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t(ui, 'addToCart', lang)}
      </a>
    </article>
  );
}
