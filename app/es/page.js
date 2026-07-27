import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import BuildStatus from '@/components/build-status';

// Spanish home at /es/ — the live site's own path. Spanish sub-pages use
// translated slugs (/es/acerca-de/ etc.), resolved via data/routes.json.
export default function HomeEs() {
  return (
    <>
      <SiteHeader lang="es" path="/es/" />
      <BuildStatus lang="es" pageName="Inicio" />
      <SiteFooter lang="es" />
    </>
  );
}
