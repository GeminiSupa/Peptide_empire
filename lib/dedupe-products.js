const nameKey = (product) => String(product.name ?? product.store?.name ?? product.slug ?? '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const productSlug = (product) => String(product.href ?? product.en ?? product.slug ?? '')
  .replace(/^\/+|\/+$/g, '')
  .split('/')
  .pop();

const preference = (product) => {
  const slug = productSlug(product);
  // The harvested `*test` page is excluded from generated product routes.
  if (slug === 'pt-141-10mgtest') return -1;
  return slug.startsWith('lp-') ? 0 : 1;
};

/** Show each name and strength once, preferring its regular product page. */
export function dedupeProducts(products) {
  const byName = new Map();
  for (const product of products ?? []) {
    const key = nameKey(product);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || preference(product) > preference(current)) byName.set(key, product);
  }
  return [...byName.values()];
}
