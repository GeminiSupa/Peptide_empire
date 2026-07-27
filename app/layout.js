import { Inter, Open_Sans } from 'next/font/google';
import './globals.css';

// The live site loads Open Sans for body copy and Inter for the h1.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' });

/**
 * The real origin, never a *.vercel.app URL. Reading it from an env var means
 * the live domain drops in without editing code. Falls back to the real domain
 * so a missing env var can never bake a preview host into shipped metadata.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://peptidescostarica.net';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Péptidos Costa Rica | Péptidos de Alta Pureza y Envío Rápido',
    template: '%s | Peptides Costa Rica',
  },
  /**
   * PRE-LAUNCH ONLY — this is a replica of a live site. If it gets indexed it
   * competes with the real one for the same keywords.
   *
   * Removing this is a launch-day checklist item, done at the same moment as
   * the Disallow in public/robots.txt. Verify BOTH in the built HTML.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
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
