import { cache } from 'react';
import currentProducts from '@/data/home-catalog-products.json';
import storeData from '@/data/wp/store-products.json';

// This is the catalog's public browser key. It is already shipped to visitors by
// the catalog site; this site only reads the public product, rank and stock fields.
const CATALOG_PRODUCTS_URL =
  'https://cbanvzipzfmllexraiei.supabase.co/rest/v1/products?select=product,priority,inventory_count,status,price_crc,price_usd,image_url&order=priority.asc&limit=1000';
const CATALOG_PUBLIC_KEY = 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';

const fallbackNames = [
  'GLP-1 5mg', 'GLP-1 10mg', 'GLP-1 12mg', 'GLP-1 15mg',
  'GLP-1 20mg', 'GLP-1 30mg', 'GLP-1 50mg', 'GLP-1 60mg',
  'Tirzepatide 10mg', 'Tirzepatide 15mg', 'Tirzepatide 20mg',
  'Tirzepatide 30mg', 'Tirzepatide 40mg', 'Tirzepatide 60mg',
];

const productAliases = {
  bacteriostaticwater10ml: 'bacwater10ml',
  bacteriostaticwater3ml: 'bacwater3ml',
  bpc157tb50020mgwolverinestack: 'bpc157tb500wolverinestack20mg',
  cjc1295withoutdacipa10mg: 'cjc1295withoutdacipamorelin',
  cjcwithdac5mg: 'cjc1295withdac5mg',
};

export const productKey = (name) => {
  const key = String(name || '')
    .toLowerCase()
    .replace(/glp-1 \(rt\)\s*[–-]\s*agonista triple/g, 'glp-1')
    .replace(/[^a-z0-9]/g, '');
  return productAliases[key] || key;
};

const storeProducts = (storeData.products ?? []).map((product) => ({
  name: product.name,
  price: product.price,
  href: `/product/${product.slug}/`,
  image: product.images?.[0],
  category: product.categories?.[0]?.name?.replaceAll('&amp;', '&'),
}));

const byName = new Map();
for (const product of [...currentProducts, ...storeProducts]) {
  const key = productKey(product.name);
  if (key && !byName.has(key)) byName.set(key, product);
}

export const allHomeProducts = [...byName.values()];

export const getLiveCatalogRows = cache(async () => {
  try {
    const response = await fetch(CATALOG_PRODUCTS_URL, {
      headers: { apikey: CATALOG_PUBLIC_KEY },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
});

const available = (row) => row?.status === 'In Stock'
  && (row.inventory_count == null || Number(row.inventory_count) > 0);

const displayPrice = (row) => {
  const parse = (value) => Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  const crc = parse(row?.price_crc);
  if (Number.isFinite(crc) && crc > 0) return `₡ ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(crc)}`;
  const usd = parse(row?.price_usd);
  if (Number.isFinite(usd) && usd > 0) return `$ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd)}`;
  return null;
};

/** The catalog is the only price and stock authority. Never display harvested prices. */
export function withLiveCatalogProduct(product, rows) {
  const row = rows?.find((candidate) => productKey(candidate.product) === productKey(product?.name));
  return {
    ...product,
    price: row && available(row) ? displayPrice(row) : null,
    currency: null,
    image: row?.image_url || product?.image || null,
    inStock: row ? available(row) : null,
  };
}

export function rankedHomeProducts(rows, count = 11) {
  const names = rows
    ? rows.filter(available).sort((a, b) => a.priority - b.priority).map((row) => row.product)
    : fallbackNames;
  const result = [];
  const seen = new Set();
  for (const name of names) {
    const key = productKey(name);
    const product = byName.get(key);
    if (!product || seen.has(key)) continue;
    result.push(product);
    seen.add(key);
    if (result.length >= count) break;
  }
  return result;
}

export function inStockHomeProducts(products, rows) {
  if (!rows) return products;
  const availableNames = new Set(rows.filter(available).map((row) => productKey(row.product)));
  return products.filter((product) => availableNames.has(productKey(product.name)));
}
