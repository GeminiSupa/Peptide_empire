import localFont from 'next/font/local';
import SiteTracking from '@/components/site/site-tracking';
import { ALLOW_INDEXING } from '@/lib/indexing';
import '@/catalog/globals.css';

/**
 * Root layout for the payment pages copied from the catalog
 * (scripts/sync-catalog-checkout.mjs): /pay-card/, /pay-bank/ and
 * /order-confirmation/.
 *
 * A root layout of its own so the catalog's stylesheet, which those pages are
 * drawn with, loads here and nowhere else: moving between root layouts is a
 * full page load, so it never mixes with the site's own CSS. Fonts are the
 * catalog's, as its root layout loads them. Tracking is this site's GTM
 * container, the one the catalog reports to, so the purchase event these
 * pages push reaches the same reports.
 */
const montserrat = localFont({
  src: './fonts/montserrat-latin-variable.woff2',
  variable: '--font-montserrat',
  weight: '100 900',
  display: 'swap',
});

const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  preload: false,
});

export const metadata = {
  title: 'Peptides Costa Rica',
  // Payment and confirmation pages are never search results.
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: [
      { url: '/wp-content/uploads/2026/02/cropped-Peptides-Fave-Icon-02-32x32.png', sizes: '32x32' },
      { url: '/wp-content/uploads/2026/02/cropped-Peptides-Fave-Icon-02-192x192.png', sizes: '192x192' },
    ],
  },
};

export default function PayLayout({ children }) {
  return (
    <html lang="es" className={`${montserrat.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <SiteTracking enabled={ALLOW_INDEXING} />
        {children}
      </body>
    </html>
  );
}
