const SHOPPER_APPROVED_SEAL = 'https://www.shopperapproved.com/seals/42340-m.gif';

/**
 * Shopper Approved's official medium seal, matching the catalog project.
 * Keep this shared so every visual Shopper Approved mention uses their mark.
 */
export default function ShopperApprovedLogo({ width = 48, decorative = false, className = '' }) {
  return (
    <img
      className={className || undefined}
      src={SHOPPER_APPROVED_SEAL}
      alt={decorative ? '' : 'Shopper Approved'}
      width={width}
      height={Math.round(width / 2)}
      loading="lazy"
      style={{ border: 0, display: 'block', width: `${width}px`, maxWidth: '100%', height: 'auto' }}
    />
  );
}
