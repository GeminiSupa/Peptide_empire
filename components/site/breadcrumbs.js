import { Fragment } from 'react';
import Link from 'next/link';
import JsonLd from '@/components/site/json-ld';
import { SITE_URL } from '@/lib/indexing';
import { breadcrumbNode } from '@/lib/site/structured-data.mjs';

/**
 * The breadcrumb, drawn and described from one list, so the visible trail
 * and Google's BreadcrumbList can never disagree.
 *
 * `items`: `[{ name, href }]`, home first; the last item is the current page
 * (drawn bold, no link). `url` is the current page's own path.
 */
export default function Breadcrumbs({ items, url, label = 'Breadcrumb', dark = false }) {
  const last = items.length - 1;
  return (
    <>
      <nav className={`bc${dark ? ' dark' : ''}`} aria-label={label}>
        {items.map((item, index) => (
          <Fragment key={`${item.name}-${index}`}>
            {index ? <span>/</span> : null}
            {index === last ? <b>{item.name}</b> : <Link href={item.href}>{item.name}</Link>}
          </Fragment>
        ))}
      </nav>
      <JsonLd nodes={[breadcrumbNode({ base: SITE_URL, url, items })]} />
    </>
  );
}
