/**
 * Content images are stored in content/ as PATHS ONLY
 * (e.g. `/wp-content/uploads/2026/01/hero.webp`), never as full URLs.
 *
 * That keeps the origin in one place. During the rebuild it points at the live
 * WordPress site so the replica looks right immediately; before launch it moves
 * to local files or Supabase Storage by changing this base — no content file
 * gets edited, and no `*.vercel.app` URL is ever written into shipped code.
 */
const BASE = (process.env.NEXT_PUBLIC_IMAGE_BASE || '').replace(/\/+$/, '');

export function imageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  const clean = path.startsWith('/') ? path : `/${path}`;
  return BASE ? `${BASE}${clean}` : clean;
}
