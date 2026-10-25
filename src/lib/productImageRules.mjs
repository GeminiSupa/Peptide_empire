/**
 * What a catalog product photo has to look like.
 *
 * The catalog draws every product into a fixed, tall picture box and shrinks
 * the whole file until it fits. So a square file, or one with blank space
 * around the vial, is scaled down until that blank space fits too, and the
 * vial itself ends up far smaller than its neighbours. Six products reached
 * the live catalog that way - GHRP-6, SNAP-8, TB-500, VIP, AA Water and HMG -
 * each a square file whose vial covered about a third of the width.
 *
 * These numbers come from measuring all 80 live product images. The 74 that
 * render correctly sit between 0.433 and 0.450 wide-over-tall, and their vial
 * fills at least 90% of the width and 87% of the height. The limits below are
 * set outside that band so no existing-style photo is refused, while the
 * square files that caused the problem are.
 *
 * Only product photos are measured. Blog covers go through the same upload
 * route and are meant to be wide, so they are left alone.
 */

export const PRODUCT_IMAGE_RULES = {
  /** Smallest acceptable pixel size. The smallest good photo today is 335x745. */
  minWidth: 330,
  minHeight: 730,
  /**
   * Width divided by height. 0.40 is 2.5x taller than wide, 0.50 is 2x taller
   * than wide. Every good photo today is 0.433-0.450; a square is 1.0.
   */
  minRatio: 0.40,
  maxRatio: 0.50,
  /**
   * How much of the frame the product itself must cover, side to side and top
   * to bottom, once blank edges are discounted. Good photos manage 0.87+.
   */
  minFill: 0.80,
  /** The size to aim for, quoted back to whoever is uploading. */
  idealWidth: 450,
  idealHeight: 1000,
};

/** The rules, shown in the admin popup. Short on purpose. */
export function productImageRequirements(rules = PRODUCT_IMAGE_RULES) {
  return [
    `Best size: ${rules.idealWidth} x ${rules.idealHeight}`,
    `Minimum: ${rules.minWidth} x ${rules.minHeight}`,
    'Shape: 2 to 2.5x taller than wide',
    `Product fills ${Math.round(rules.minFill * 100)}%+ of the frame`,
  ];
}

/**
 * Reads the real pixels: the size of the file, and the size of the part that
 * is not blank edge. `trim` finds the blank border the same way a person would
 * crop it - by matching the colour of the corner, transparent or white alike.
 *
 * Throws if the file cannot be read as an image at all.
 */
export async function measureProductImage(buffer) {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(buffer).metadata();
  const width = Number(meta.width) || 0;
  const height = Number(meta.height) || 0;
  if (!width || !height) throw new Error('The image size could not be read.');

  // A picture with no blank border to remove, or one that is a single flat
  // colour, makes trim throw. Neither is a reason to reject: fall back to
  // treating it as full, and let the shape and size rules speak.
  let fillWidth = 1;
  let fillHeight = 1;
  try {
    const trimmed = await sharp(buffer).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    if (trimmed.info.width > 0 && trimmed.info.height > 0) {
      fillWidth = Math.min(1, trimmed.info.width / width);
      fillHeight = Math.min(1, trimmed.info.height / height);
    }
  } catch {
    /* nothing to trim */
  }

  return { width, height, ratio: width / height, fillWidth, fillHeight };
}

/** Formats trimmed and written back as themselves. Anything else is stored as uploaded. */
const TRIMMABLE_FORMATS = new Set(['png', 'jpeg', 'webp', 'avif']);

/**
 * Crops the blank border off a product photo, so the vial fills the frame the
 * way every other catalog photo does. The designer's newer photos are a vial
 * in the middle of a big transparent square - the vial is the right shape, it
 * just covers a third of the width, so the catalog drew it at a third of the
 * size. Cropped, it comes out the same tall shape as the rest.
 *
 * Returns the original bytes untouched when there is nothing worth cropping,
 * the format is one we would not write back the same way (HEIC, GIF, SVG), or
 * anything about the image cannot be read. Never makes an upload fail.
 */
export async function trimProductImage(buffer) {
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    if (!TRIMMABLE_FORMATS.has(meta.format) || (meta.pages || 1) > 1) return { buffer, trimmed: false };

    const width = Number(meta.width) || 0;
    const height = Number(meta.height) || 0;
    if (!width || !height) return { buffer, trimmed: false };

    // rotate() with no angle applies a phone photo's orientation tag before
    // cropping, so the crop lands on the picture as it is seen.
    const result = await sharp(buffer)
      .rotate()
      .trim({ threshold: 10 })
      .toFormat(meta.format, { quality: 92 })
      .toBuffer({ resolveWithObject: true });

    // Already as tight as the photos that look right on the catalog (they keep
    // 86%+ of each side): leave it exactly as uploaded rather than change how
    // an existing-style photo looks.
    const keptWidth = result.info.width / width;
    const keptHeight = result.info.height / height;
    if (keptWidth >= PRODUCT_IMAGE_RULES.minFill && keptHeight >= PRODUCT_IMAGE_RULES.minFill) {
      return { buffer, trimmed: false };
    }

    return { buffer: result.data, trimmed: true, width: result.info.width, height: result.info.height };
  } catch {
    return { buffer, trimmed: false };
  }
}

/**
 * What is wrong with the picture, one short line each. Empty list means it
 * passes. Every line names the number measured and the number required, so
 * nobody has to come back and ask what to change it to.
 */
export function checkProductImage(measured, rules = PRODUCT_IMAGE_RULES) {
  const { width, height, ratio, fillWidth, fillHeight } = measured;
  const problems = [];

  if (width < rules.minWidth || height < rules.minHeight) {
    problems.push(`Too small: ${width} x ${height}. Minimum is ${rules.minWidth} x ${rules.minHeight}.`);
  }

  if (ratio > rules.maxRatio || ratio < rules.minRatio) {
    const shape = ratio >= 0.95 && ratio <= 1.05 ? 'square' : ratio > rules.maxRatio ? 'too wide' : 'too thin';
    problems.push(`Wrong shape: ${width} x ${height} is ${shape}. Must be 2 to 2.5x taller than wide.`);
  }

  if (fillWidth < rules.minFill || fillHeight < rules.minFill) {
    problems.push(
      `Too much empty space: product fills only ${Math.round(fillWidth * 100)}% x ${Math.round(fillHeight * 100)}% `
      + `of the frame. Must be ${Math.round(rules.minFill * 100)}%+. Crop the blank edges off.`,
    );
  }

  return { ok: problems.length === 0, problems };
}

/**
 * How opaque a corner pixel has to be before the background counts as filled
 * in. 255 is solid; anything under this is letting the page colour through.
 */
const OPAQUE_ALPHA = 250;

/** What a product photo's background has to be, shown in the admin popup. */
export function productImageBackgroundRequirements() {
  return [
    'PNG with a see-through (transparent) background',
    'Not JPG — a JPG always fills the background in, usually with white',
    'Export with the background layer hidden, so only the vial is visible',
  ];
}

/**
 * Does the photo have a see-through background?
 *
 * Every vial on the catalog is a PNG whose background is transparent, so the
 * page colour shows through behind it. A JPEG cannot carry transparency at
 * all - whatever sat behind the vial is baked into the pixels, and on the
 * cream product page that arrives as a white box around the vial. All ten
 * GLP-1 (RT) sizes and BPC-157 10mg reached the live catalog that way in
 * Oct 2026, and the files cannot be repaired afterwards: erasing the white
 * would take the vial's glass and the white text on the label with it.
 *
 * An alpha channel on its own is not proof, since a PNG can be saved with its
 * background painted in, so the four corners are sampled. All four have to be
 * solid before the photo is refused - one corner clipped by the vial is not
 * enough to call the background filled.
 *
 * Returns { ok, problems }. Never throws: a file that cannot be measured is
 * allowed through, the same choice measureProductImage makes, so a missing
 * image library cannot block every upload.
 */
export async function checkProductImageBackground(buffer) {
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();

    if (!meta.hasAlpha) {
      const format = String(meta.format || 'this file').toUpperCase();
      return {
        ok: false,
        problems: [
          `${format} cannot have a see-through background, so the vial arrives in a solid box `
          + 'that shows up against the cream product page. Save it as a PNG instead.',
        ],
      };
    }

    const width = Number(meta.width) || 0;
    const height = Number(meta.height) || 0;
    if (!width || !height) return { ok: true, problems: [] };

    const corners = [
      { left: 0, top: 0 },
      { left: width - 1, top: 0 },
      { left: 0, top: height - 1 },
      { left: width - 1, top: height - 1 },
    ];

    let solidCorners = 0;
    for (const corner of corners) {
      const { data } = await sharp(buffer)
        .ensureAlpha()
        .extract({ ...corner, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (data[3] >= OPAQUE_ALPHA) solidCorners += 1;
    }

    if (solidCorners === corners.length) {
      return {
        ok: false,
        problems: [
          'The background is painted in rather than see-through, so the vial arrives in a solid '
          + 'box that shows up against the cream product page. Export it again with the '
          + 'background layer hidden.',
        ],
      };
    }

    return { ok: true, problems: [] };
  } catch {
    return { ok: true, problems: [] };
  }
}
