import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import BuildStatus from '@/components/build-status';

// English home. Path matches the live site exactly: English lives at `/`.
export default function HomeEn() {
  return (
    <>
      <SiteHeader lang="en" path="/" />
      <BuildStatus lang="en" pageName="Home" />
      <SiteFooter lang="en" />
    </>
  );
}
