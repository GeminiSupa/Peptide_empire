import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/adminAuth';
import {
  PRODUCT_IMAGE_RULES,
  checkProductImage,
  checkProductImageBackground,
  measureProductImage,
  productImageBackgroundRequirements,
  productImageRequirements,
  trimProductImage,
} from '@/lib/productImageRules';

export const runtime = 'nodejs';

/**
 * Product and blog images, uploaded through the server.
 *
 * The admin page used to push these straight from the browser with the public
 * anon key, which Supabase Storage refuses: "new row violates row-level
 * security policy". The bucket being public was never the problem — public
 * governs reading, not writing — so the old error message sent people to check
 * a setting that was already correct.
 *
 * Granting the anon key write access would have fixed it and opened the bucket
 * to the entire internet, since that key ships in the page. Uploading here with
 * the service role instead keeps writes behind an admin session, and matches
 * what orders/upload-proof already does with the same bucket.
 */

const BUCKET = 'product-pics';

/** One year, as seconds. See the note at the upload call. */
const IMAGE_CACHE_SECONDS = '31536000';

// Must match the bucket's own file_size_limit. Checked here as well so an
// oversized file is refused with its actual size named, rather than with the
// bucket's own message, which nobody can act on. Raised from 5 MB on request
// (Oct 2026) - the bucket's own limit has to be raised to match or Supabase
// refuses the file before this number means anything.
const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/**
 * Shape, pixel-size and empty-space rules for product photos, off on request
 * (Oct 2026; turned back on once, then off again on 24 Oct) because they were
 * refusing images the owner wanted to try on the catalog and see how they
 * look. Flip this back to true to re-enable them; the rules
 * themselves are untouched in src/lib/productImageRules.mjs.
 *
 * While this is false a square or small photo will upload, and will render
 * shrunken next to its neighbours on the catalog - that is the trade being
 * made here, not an oversight.
 */
const ENFORCE_PRODUCT_IMAGE_RULES = false;

/**
 * The background rule, which is separate from the shape and size rules above
 * and is ON. It refuses only one thing: a product photo whose background is
 * not see-through. That is not a matter of taste like the shape limits were -
 * a filled background draws a solid box around the vial on the cream product
 * page, and once a photo is saved as a JPEG the transparency is gone for good.
 * Caught at upload, the person still has the original and can export it again.
 *
 * Flip this to false to turn it off; the check itself lives in
 * src/lib/productImageRules.mjs and is untouched by the flag.
 */
const ENFORCE_PRODUCT_IMAGE_BACKGROUND = true;

const PREFIXES = { product: '', blog: 'blog-' };

export async function POST(request) {
  // Either tab can put an image in the shared bucket; both are staff-only.
  const auth = await verifyAdminSession(request, { requireAnyPermission: ['spreadsheet', 'cms'] });
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') || 'product');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file was received.' }, { status: 400 });
    }

    // Any image format is accepted now. This used to be a fixed list of five
    // types, which refused files the browser labelled with something else
    // (HEIC off a phone, image/jpg instead of image/jpeg).
    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `${file.type} is not an image. Pick an image file.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `That image is ${mb} MB. The limit is ${MAX_MB} MB, so please resize it and try again.` },
        { status: 413 },
      );
    }

    let bytes = Buffer.from(await file.arrayBuffer());

    // Checked on the file as it arrived, before anything is cropped, so the
    // message names what the person actually picked. Blog covers are meant to
    // be ordinary photographs, so they are never asked for transparency.
    if (ENFORCE_PRODUCT_IMAGE_BACKGROUND && kind === 'product') {
      const background = await checkProductImageBackground(bytes);
      if (!background.ok) {
        return NextResponse.json(
          {
            error: background.problems[0],
            imageCheck: {
              problems: background.problems,
              requirements: productImageBackgroundRequirements(),
            },
          },
          { status: 422 },
        );
      }
    }

    // A vial sitting in the middle of a big blank square renders at a fraction
    // of its neighbours' size, so the blank border is cropped off before the
    // photo is stored. Blog covers are left as uploaded.
    if (kind === 'product') {
      bytes = (await trimProductImage(bytes)).buffer;
    }

    // Product photos are measured before they are stored. The catalog scales
    // the whole file into a fixed tall box, so a square photo, or one with
    // blank space around the vial, renders the product far smaller than its
    // neighbours - which is how six products ended up looking shrunken on the
    // live catalog. Refusing the file here is the only point where the person
    // who has the original is still standing in front of it.
    //
    // Blog covers go through this same route and are supposed to be wide, so
    // they are deliberately not measured.
    if (ENFORCE_PRODUCT_IMAGE_RULES && kind === 'product') {
      let measured = null;
      try {
        measured = await measureProductImage(bytes);
      } catch (measureError) {
        // A file we cannot measure is not a file we can judge. Letting it
        // through beats blocking every upload because the image library is
        // unavailable, but it is logged so it does not pass silently.
        console.error('Product image could not be measured, allowing upload:', measureError?.message);
      }

      if (measured) {
        const verdict = checkProductImage(measured);
        if (!verdict.ok) {
          return NextResponse.json(
            {
              error: verdict.problems[0],
              imageCheck: {
                problems: verdict.problems,
                requirements: productImageRequirements(),
                measured: {
                  width: measured.width,
                  height: measured.height,
                  fillWidthPct: Math.round(measured.fillWidth * 100),
                  fillHeightPct: Math.round(measured.fillHeight * 100),
                },
                ideal: `${PRODUCT_IMAGE_RULES.idealWidth} x ${PRODUCT_IMAGE_RULES.idealHeight}`,
              },
            },
            { status: 422 },
          );
        }
      }
    }

    const extension = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = PREFIXES[kind] ?? '';
    const path = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
        // A year. Supabase defaults to an hour, which means every visitor
        // re-downloads every product image once an hour, all month — the
        // catalogue is ~9 MB of images and that was the bulk of an egress
        // allowance that went 10% over.
        //
        // Safe to cache this hard because the filename above is a timestamp
        // plus random suffix: a replaced image is a NEW path, so nobody is
        // ever served a stale one. Never reuse a path for different content.
        cacheControl: IMAGE_CACHE_SECONDS,
      });

    // Passed back as-is rather than replaced with a guess: the guess is what
    // made this hard to diagnose in the first place.
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, path });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Upload failed.' }, { status: 500 });
  }
}

// There is deliberately no DELETE here. Uploading a replacement leaves the old
// file in storage: a delete endpoint reachable from the product grid meant a
// mis-click could destroy an image for good, and take out anything else still
// pointing at that URL.
