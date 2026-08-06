import { Inter, Open_Sans } from 'next/font/google';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/indexing';
import './globals.css';

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
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function RootLayout({ children }) {
  return (
    // Spanish is the default language: the customers are Spanish-speaking.
    // The URL structure still matches the live site exactly (English at `/`,
    // Spanish at its own translated slugs) so no indexed URL moves.
    <html lang="es" className={`${inter.variable} ${openSans.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
