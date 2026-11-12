export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    alternates: {
      canonical: `https://peptidescostarica.net/blog/${encodeURIComponent(slug)}/`,
    },
  };
}

export default function BlogPostLayout({ children }) {
  return children;
}
