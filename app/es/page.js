import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { sections } from '@/content/pages/home';

// Spanish home at /es/ — the live site's own path. One content file serves both
// languages; the `_es` fields supply the translations.
export default function HomeEs() {
  return (
    <>
      <SiteHeader lang="es" path="/es/" />
      <main className="flex-1">
        <Sections sections={sections} lang="es" />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}
