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
 */
const LOGO_SRC = '/wp-content/uploads/2026/02/COSTA-RICA-1-e1771916272916.png';

export default function Logo({ lang = DEFAULT_LANG, className = '', imageClassName = 'h-11 w-auto sm:h-12' }) {
  return (
    <Link
      aria-label="Peptides Costa Rica"
      className={`inline-flex items-center ${className}`}
      href={localePath('/', lang)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- harvested asset
          served from public/, at the live site's own dimensions. */}
      <img
        alt="Peptides Costa Rica"
        className={imageClassName}
        height={148}
        src={imageUrl(LOGO_SRC)}
        width={300}
      />
    </Link>
  );
}
