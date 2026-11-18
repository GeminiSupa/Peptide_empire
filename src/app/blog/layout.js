export const metadata = {
  title: 'Guías de Investigación de Péptidos',
  description: 'Artículos claros y basados en evidencia sobre investigación de péptidos, documentación y novedades de Peptidos Colombia.',
  // The same articles appear on both sites; the main website is the one
  // search engines and AI crawlers should treat as authoritative.
  alternates: { canonical: 'https://peptidescostarica.net/blog/' },
};

export default function BlogLayout({ children }) {
  return children;
}
