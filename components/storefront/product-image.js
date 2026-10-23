import Ms from '@/components/storefront/icon';

/**
 * A product photo, or a placeholder when the row has none.
 *
 * Not every `products` row carries an `image_url`, and an `<img src="">` is
 * not an empty image: the browser resolves it to the page itself and
 * downloads the whole document again, which React warns about on every
 * render. A compound with no photo gets a vial glyph instead.
 */
export default function ProductImage({ src, alt = '', className = '', loading }) {
  if (!src) {
    return (
      <span className={`noimg${className ? ` ${className}` : ''}`} role="img" aria-label={alt}>
        <Ms name="science" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase storage URL, no loader
    <img className={className} src={src} alt={alt} loading={loading} />
  );
}
