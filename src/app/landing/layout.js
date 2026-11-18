export const metadata = {
  title: 'Personalized Research Guidance',
  description: 'Tell us what you are researching and receive personalized product, documentation, and availability guidance from Peptidos Colombia.',
  alternates: {
    canonical: '/landing',
    languages: {
      'es-CR': '/landing?lang=es',
      'en-US': '/landing?lang=en',
    },
  },
  openGraph: {
    title: 'Personalized Research Guidance | Peptidos Colombia',
    description: 'Local inventory, documented batches, and personalized support for qualified research enquiries.',
    url: '/landing',
    images: ['/catalog-promo-banner.webp'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Personalized Research Guidance | Peptidos Colombia',
    description: 'Local inventory, documented batches, and personalized support for qualified research enquiries.',
    images: ['/catalog-promo-banner.webp'],
  },
};

export default function LandingLayout({ children }) {
  return children;
}
