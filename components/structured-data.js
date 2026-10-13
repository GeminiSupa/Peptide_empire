import { seoForPath } from '@/lib/seo';

/** Preserve the live WordPress JSON-LD graph for this exact canonical path. */
export default function StructuredData({ path }) {
  const schemas = seoForPath(path)?.schemas || [];
  if (!schemas.length) return null;

  return schemas.map((schema, index) => (
    <script
      // The harvested live site is trusted, but escaping `<` prevents a JSON
      // string containing `</script>` from terminating the element early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll('<', '\\u003c') }}
      key={`${path}-schema-${index}`}
      type="application/ld+json"
    />
  ));
}
