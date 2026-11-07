import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/adminAuth';

export const runtime = 'nodejs';

const BUCKET = 'product-pics';
const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const PREFIXES = { product: '', blog: 'blog-' };

/**
 * Creates a one-file upload token for an authenticated staff member.
 *
 * Sending large files through a Vercel Route Handler can be rejected before
 * the handler runs. The token keeps authorization on the server, while the
 * browser sends the file directly to Supabase Storage.
 */
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireAnyPermission: ['spreadsheet', 'cms'] });
  if (auth.error) return auth.error;

  try {
    const { name, type, size, kind = 'product' } = await request.json();

    if (!name || !Number.isFinite(size)) {
      return NextResponse.json({ error: 'No image details were received.' }, { status: 400 });
    }

    if (type && !type.startsWith('image/')) {
      return NextResponse.json({ error: `${type} is not an image. Pick an image file.` }, { status: 400 });
    }

    if (size > MAX_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `That image is ${mb} MB. The limit is ${MAX_MB} MB, so please resize it and try again.` },
        { status: 413 },
      );
    }

    const extension = String(name).split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const prefix = PREFIXES[kind] ?? '';
    const path = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

    if (error) {
      console.error('[image/upload-sign]', error);
      return NextResponse.json({ error: error.message || 'Could not prepare the image upload.' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, path, token: data.token, url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('[image/upload-sign]', error);
    return NextResponse.json({ error: error.message || 'Could not prepare the image upload.' }, { status: 500 });
  }
}
