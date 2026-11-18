import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /for-professionals/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/for-professionals/', {
      title: 'For Clinics, Labs & Professionals | Peptidos Colombia',
      description: 'Professional pricing, larger and custom vial sizes, COAs and company invoicing for verified clinics, labs and research businesses in Colombia.',
      en: '/for-professionals/',
      es: '/es/para-profesionales/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="for-professionals" lang="en" />;
}
