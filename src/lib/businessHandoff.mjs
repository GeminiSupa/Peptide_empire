export const BUSINESS_QUOTE_STORAGE_KEY='business-checkout-quote';
export const BUSINESS_REFERRAL_STORAGE_KEY='business-signup-referral';

export function readBusinessQuote(raw, businessId, now=Date.now()) {
  try {
    const quote=typeof raw==='string'?JSON.parse(raw):raw;
    if(!quote?.id || quote.business_id!==businessId || quote.status!=='approved' || !Array.isArray(quote.items) || !quote.items.length || !Number.isFinite(Date.parse(quote.expires_at)) || Date.parse(quote.expires_at)<=now) return null;
    return quote;
  }catch{return null;}
}
