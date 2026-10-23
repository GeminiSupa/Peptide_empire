/**
 * A Material Symbols Rounded glyph.
 *
 * The design draws every icon as a ligature: the span's text is the icon name
 * and the font turns it into the glyph. `.ms` sizes and aligns it, `.ms.f`
 * fills it. Kept as the design has it rather than swapped for an SVG set,
 * because the stylesheet sizes these with `font-size` in 39 places.
 *
 * The font is loaded once by `components/storefront/storefront.js`.
 */
export default function Ms({ name, filled = false, className = '', style }) {
  return (
    <span aria-hidden="true" className={`ms${filled ? ' f' : ''}${className ? ` ${className}` : ''}`} style={style}>
      {name}
    </span>
  );
}
