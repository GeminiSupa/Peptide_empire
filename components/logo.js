import Link from 'next/link';
import { localePath } from '@/lib/site';

/**
 * PLACEHOLDER LOCKUP.
 *
 * The live site's logo is a raster image scaled to 300x148. We have asked the
 * client for the original (ideally SVG) rather than shipping a low-quality
 * scrape. Swap this for next/image once the real asset lands; the outer
 * dimensions here match the live header so the swap won't shift layout.
 */
export default function Logo({ lang = 'en', className = '' }) {
  return (
    <Link
      href={localePath('/', lang)}
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="Peptides Costa Rica — home"
    >
      <svg
        viewBox="0 0 40 40"
        className="h-9 w-9 shrink-0"
        aria-hidden="true"
        fill="none"
      >
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" className="text-primary" />
        <ellipse cx="20" cy="20" rx="18" ry="7" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
        <ellipse cx="20" cy="20" rx="7" ry="18" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
        <circle cx="20" cy="20" r="3.5" fill="currentColor" className="text-primary" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-tight text-primary sm:text-lg">
          Peptides Costa Rica
        </span>
        <span className="mt-0.5 text-[9px] font-semibold tracking-[0.18em] text-text-muted uppercase sm:text-[10px]">
          Research Grade
        </span>
      </span>
    </Link>
  );
}
