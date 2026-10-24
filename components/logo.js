import Link from 'next/link';
import { localePath, DEFAULT_LANG } from '@/lib/routes';
import { imageUrl } from '@/lib/images';

/**
 * The site logo — the real one.
 *
 * This was a hand-drawn SVG placeholder for far too long. Its own comment said
 * the real file would be swapped in "in the next step"; the file was mirrored
 * into public/ on 27 July and the swap never happened, so every page shipped a
 * generic circle instead of the client's logo.
 *
 * Served from public/ like every other content image, so it resolves through
 * NEXT_PUBLIC_IMAGE_BASE and carries no dependency on the WordPress origin.
 *
 * Since 24 Oct 2026 this is the catalog's square badge (the same file as
 * catalog.peptidescostarica.net/logo.webp), matching the storefront header.
 * It is near-square where the old wordmark was 2:1, so callers size it by
 * height; the rounded corners match the storefront's.
 */
const LOGO_SRC = '/catalog-logo.webp';

export default function Logo({ lang = DEFAULT_LANG, className = '', imageClassName = 'h-11 w-auto sm:h-12', loading = 'eager' }) {
  return (
    <Link
      aria-label="Peptides Costa Rica"
      className={`inline-flex shrink-0 items-center ${className}`}
      href={localePath('/', lang)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- harvested asset
          served from public/, at the live site's own dimensions. */}
      <img
        alt="Peptides Costa Rica"
        className={`rounded-[7px] ${imageClassName}`}
        decoding="async"
        height={600}
        loading={loading}
        src={imageUrl(LOGO_SRC)}
        width={714}
      />
    </Link>
  );
}
