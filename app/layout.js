import { Inter, Open_Sans } from 'next/font/google';
import './globals.css';

// The live site loads Open Sans for body copy and Inter for the h1.
// Matching both keeps the re-platform visually identical.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://peptidescostarica.net'),
  title: {
    default: 'Peptides Costa Rica | High-Purity Peptides and Fast Shipping',
    template: '%s | Peptides Costa Rica',
  },
  description:
    'Peptides Costa Rica offers premium, research-backed peptides for weight loss, muscle growth, energy, recovery, and healthy aging — with trusted quality and bulk savings across Costa Rica.',
  // PRE-LAUNCH ONLY. This build lives on a temporary domain and must not be
  // indexed. Removing this is a launch-day checklist item, done at the same
  // time as the Disallow in public/robots.txt.
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${openSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
