import { shopperApprovedDisplayConfig } from '@/lib/shopperApproved.mjs';
import ReviewsPageClient from './ReviewsPageClient';

export default function ReviewsPage() {
  const display = shopperApprovedDisplayConfig();
  return <ReviewsPageClient display={display} />;
}
