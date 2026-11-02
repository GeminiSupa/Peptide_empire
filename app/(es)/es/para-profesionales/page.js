import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /es/para-profesionales/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/es/para-profesionales/', {
      title: 'Para clínicas, laboratorios y profesionales | Péptidos Costa Rica',
      description: 'Precios profesionales, viales más grandes y a medida, COA y facturación empresarial para clínicas, laboratorios y empresas de investigación verificadas en Costa Rica.',
      en: '/for-professionals/',
      es: '/es/para-profesionales/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="for-professionals" lang="es" />;
}
