import Ms from '@/components/storefront/icon';
import { getApprovedReviews, reviewsForCompound, shortName } from '@/lib/site/product-reviews.mjs';

/**
 * Approved customer reviews for this compound, from the catalog admin.
 * Renders nothing when there are none.
 */
export default async function CustomerReviews({ compound, t }) {
  const reviews = reviewsForCompound(await getApprovedReviews(), compound).slice(0, 6);
  if (!reviews.length) return null;
  return (
    <div className="creviews">
      {reviews.map((review) => {
        const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
        return (
          <figure key={review.id}>
            <div className="cr-stars" aria-label={t(`${rating} out of 5 stars`)}>
              {Array.from({ length: 5 }, (_, index) => (
                <Ms key={index} name="star" filled={index < rating} />
              ))}
            </div>
            <blockquote>{review.comment}</blockquote>
            <figcaption>
              <b>{shortName(review.customer_name)}</b>
              <small>{review.product_name}</small>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
