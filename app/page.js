import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { sections } from '@/content/pages/home';

// English home. Path matches the live site exactly: English lives at `/`.
export default function HomeEn() {
  return (
    <>
      <SiteHeader lang="en" path="/" />
      <main className="flex-1">
        <Sections sections={sections} lang="en" />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
