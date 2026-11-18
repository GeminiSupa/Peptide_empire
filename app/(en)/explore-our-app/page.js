import { NewPageRoute } from '@/components/site/page-route';
import { metadataForPath } from '@/lib/seo';

/** /explore-our-app/ — a page the new design adds (components/site/page-route.js). */
export function generateMetadata() {
  return {
    ...metadataForPath('/explore-our-app/', {
      title: 'Explore Our App | Peptidos Colombia',
      description: 'The Peptidos Colombia app: order in a few taps, earn points, get extra discounts and use the reconstitution calculator. Free on iPhone and Android.',
      en: '/explore-our-app/',
      es: '/es/explora-nuestra-app/',
    }),
  };
}

export default function Page() {
  return <NewPageRoute pageKey="explore-our-app" lang="en" />;
}
