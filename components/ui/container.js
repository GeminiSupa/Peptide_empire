/**
 * The site's content measure.
 *
 * 1280px with almost no gutter, because that is what the live site does: its
 * Elementor containers are `max-width: 1280px` at full width, so below 1280 the
 * content runs edge to edge and there are no side margins at all.
 *
 * The previous 1200px with `lg:px-8` left a visible band of white down both
 * sides that the original does not have — the "why does our website show space
 * at the sides" difference. The small padding that remains is for phones, where
 * text against the screen edge is unreadable.
 */
export default function Container({ className = '', children }) {
  return (
    <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-5 ${className}`}>{children}</div>
  );
}
