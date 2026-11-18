import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /thank-you/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/thank-you/', {
      title: 'Thank You | Peptidos Colombia',
      description: 'Thank you for your order with Peptidos Colombia.',
      en: '/thank-you/',
      es: '/es/gracias/',
    }),
    // An order confirmation, not a page to find in search.
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <NewPageRoute pageKey="thank-you" lang="en" />;
}
