import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /es/para-profesionales/ — a page the new design adds (components/site/page-route.js). */
export async function generateMetadata() {
  return {
    ...await metadataForPath('/es/para-profesionales/', {
      title: 'Para clínicas, laboratorios y profesionales | Peptidos Colombia',
      description: 'Precios profesionales, viales más grandes y a medida, COA y facturación empresarial para clínicas, laboratorios y empresas de investigación verificadas en Colombia.',
      en: '/for-professionals/',
      es: '/es/para-profesionales/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="for-professionals" lang="es" />;
}
