import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /deal-of-the-week/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return metadataForPath('/deal-of-the-week/', {
    title: 'Deal of the Week | Peptides Costa Rica',
    description: 'This week’s deal on research peptides in Costa Rica: spend more, save more on your whole order. Applied automatically, no code needed.',
    en: '/deal-of-the-week/',
    es: '/es/oferta-de-la-semana/',
  });
}

export default function Page() {
  return <NewPageRoute pageKey="deal-of-the-week" lang="en" />;
}
