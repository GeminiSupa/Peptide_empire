export const metadata = {
  title: 'Customer Reviews',
  description:
    'Verified customer reviews for Peptidos Colombia, powered by Shopper Approved.',
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: 'Customer Reviews | Peptidos Colombia',
    description: 'Read verified store reviews from Shopper Approved.',
    url: '/reviews',
  },
};

export default function ReviewsLayout({ children }) {
  return children;
}
