import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /es/explora-nuestra-app/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/es/explora-nuestra-app/', {
      title: 'Explora nuestra app | Peptidos Colombia',
      description: 'La app de Peptidos Colombia: pida en pocos toques, gane puntos, obtenga descuentos extra y use la calculadora de reconstitución. Gratis en iPhone y Android.',
      en: '/explore-our-app/',
      es: '/es/explora-nuestra-app/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="explore-our-app" lang="es" />;
}
