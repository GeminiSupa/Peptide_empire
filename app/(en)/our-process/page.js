import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /our-process/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/our-process/', {
      title: 'Our Process | Peptidos Colombia',
      description: 'How a vial gets from the lab to your door: nine checkpoints, third-party testing, cold storage at 2–8 °C and tracked delivery across Colombia.',
      en: '/our-process/',
      es: '/es/nuestro-proceso/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="our-process" lang="en" />;
}
