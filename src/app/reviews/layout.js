export const metadata = {
  title: 'Customer Reviews',
  description:
    'Verified customer reviews for Peptides Costa Rica, powered by Shopper Approved.',
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: 'Customer Reviews | Peptides Costa Rica',
    description: 'Read verified store reviews from Shopper Approved.',
    url: '/reviews',
  },
};

export default function ReviewsLayout({ children }) {
  return children;
}
