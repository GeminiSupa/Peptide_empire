import { Inter, Open_Sans } from 'next/font/google';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/indexing';
import AgeGate from '@/components/age-gate';
import '../globals.css';

// The live site loads Open Sans for body copy and Inter for the h1.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Péptidos Costa Rica | Péptidos de Alta Pureza y Envío Rápido',
    template: '%s | Peptides Costa Rica',
  },
  /**
   * This is a replica of a live site: if it gets indexed while the original is
   * up, the two compete for the same keywords.
   *
   * Driven by lib/indexing.js, which app/robots.js reads too — so the meta tag
   * and robots.txt can no longer disagree. Launch is a Vercel env var
   * (NEXT_PUBLIC_ALLOW_INDEXING=true), not an edit here.
   */
  robots: ALLOW_INDEXING
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
      }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  verification: {
    google: [
      'T2X0WcuoP1WnZLEoTxvIPbQVsWxO1IH0eBpOe3PYLd4',
      'pBiBnUTxYMA5ZEMnX4xn2x_0km2upd9Ti5uim5aet24',
    ],
  },
  icons: {
    icon: [
      { url: '/wp-content/uploads/2026/02/cropped-Peptides-Fave-Icon-02-32x32.png', sizes: '32x32' },
      { url: '/wp-content/uploads/2026/02/cropped-Peptides-Fave-Icon-02-192x192.png', sizes: '192x192' },
    ],
    apple: '/wp-content/uploads/2026/02/cropped-Peptides-Fave-Icon-02-180x180.png',
  },
};

/**
 * Spanish, served under /es/ with translated slugs.
 *
 * There are TWO root layouts, one per language, because `<html lang>` can only
 * be set in a root layout and this site serves both languages from one app.
 * A single layout hardcoding `lang="es"` put Spanish on all 434 English pages:
 * a screen reader pronounced English copy with Spanish phonetics and search
 * engines were told the wrong language for every English URL. The route groups
 * `(en)` and `(es)` do not appear in any URL, so nothing moved.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${openSans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <AgeGate lang="es" />
        {children}
      </body>
    </html>
  );
}
