import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /es/nuestro-proceso/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/es/nuestro-proceso/', {
      title: 'Nuestro proceso | Peptidos Colombia',
      description: 'Cómo llega un vial del laboratorio a su puerta: nueve controles, análisis de terceros, almacenamiento a 2–8 °C y entrega con seguimiento en todo Colombia.',
      en: '/our-process/',
      es: '/es/nuestro-proceso/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="our-process" lang="es" />;
}
