import { graph, jsonLdText } from '@/lib/site/structured-data.mjs';

/** A JSON-LD block from structured-data nodes (lib/site/structured-data.mjs). */
export default function JsonLd({ nodes }) {
  const data = graph(nodes);
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
