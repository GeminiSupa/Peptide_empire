import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /es/gracias/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/es/gracias/', {
      title: 'Gracias | Péptidos Costa Rica',
      description: 'Gracias por su pedido con Péptidos Costa Rica.',
      en: '/thank-you/',
      es: '/es/gracias/',
    }),
    // An order confirmation, not a page to find in search.
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <NewPageRoute pageKey="thank-you" lang="es" />;
}
