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
    default: 'Peptides Costa Rica | High-Purity Peptides and Fast Shipping',
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

/**
 * English, served at the root of the URL space.
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
    <html lang="en" className={`${inter.variable} ${openSans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <AgeGate lang="en" />
        {children}
      </body>
    </html>
  );
}
