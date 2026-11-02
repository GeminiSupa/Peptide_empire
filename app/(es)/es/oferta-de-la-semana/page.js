import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /es/oferta-de-la-semana/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return metadataForPath('/es/oferta-de-la-semana/', {
    title: 'Oferta de la semana | Péptidos Costa Rica',
    description: 'La oferta de esta semana en péptidos de investigación en Costa Rica: gaste más y ahorre más en todo su pedido. Se aplica automáticamente, sin código.',
    en: '/deal-of-the-week/',
    es: '/es/oferta-de-la-semana/',
  });
}

export default function Page() {
  return <NewPageRoute pageKey="deal-of-the-week" lang="es" />;
}
