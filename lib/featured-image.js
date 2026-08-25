/**
 * The featured image of a harvested page, resolved from the WordPress data.
 *
 * The block harvester keeps a page's BODY, not the post-level metadata that
 * only ever appears somewhere else — and a featured image is exactly that. It
 * is never inside `content.rendered`; it lives on the post as `featured_media`,
 * an attachment id. So a card on /blog/ or /peptide-guides/ cannot get its
 * thumbnail from the page's own sections, which is why those two indexes
 * rendered as text-only lists while the live site showed a picture per entry.
 *
 * The join is `featured_media` -> data/wp/media.json -> `source_url`, reduced to
 * a site-relative path so lib/images.js can attach the responsive candidates.
 *
 * Products are deliberately NOT resolved here. A WooCommerce product carries its
 * image in the store payload (`store.images`), already keyed by slug in
 * content/pages/products.js, and components/product-list.js reads it directly.
 * Adding a second path to the same picture would just be a way to disagree with
 * ourselves.
 */
import mediaData from '@/data/wp/media.json';
import pageData from '@/data/wp/pages.json';
import postData from '@/data/wp/posts.json';

const rows = (d) => (Array.isArray(d) ? d : (d?.media ?? d?.pages ?? d?.posts ?? []));
const relative = (url) => (url ? url.replace(/^https?:\/\/[^/]+/, '') : null);

/** Attachment id -> site-relative path of the full-size upload. */
const BY_ID = new Map(rows(mediaData).map((m) => [m.id, relative(m.source_url)]));

/**
 * WordPress slug -> featured image path.
 *
 * Posts and pages share one map because they share one slug namespace here: our
 * blog posts come from posts.json and our guides are ordinary WordPress pages,
 * and no slug is claimed by both.
 */
const BY_SLUG = new Map();
for (const entry of [...rows(postData), ...rows(pageData)]) {
  const path = entry.featured_media ? BY_ID.get(entry.featured_media) : null;
  if (path) BY_SLUG.set(entry.slug, path);
}

/** The last path segment of a route: `/blog/what-is-retatrutide/` -> the slug. */
const segment = (path) =>
  String(path || '')
    .split('/')
    .filter(Boolean)
    .pop() ?? null;

/**
 * The featured image path for a harvested page, or null when it has none.
 *
 * Returning null is a normal outcome, not a failure: only 9 of the 12 blog posts
 * have a featured image on the live site, and the live index shows 9 pictures
 * for 12 cards. Callers skip the image rather than substituting a placeholder.
 */
export function featuredImage(page) {
  if (!page) return null;
  // A group whose harvest already captured the image says so directly; the
  // mixing guides do, because there the infographic IS the page.
  if (page.image) return page.image;
  const slug = segment(page.en ?? page.slug);
  return (slug && BY_SLUG.get(slug)) ?? null;
}
