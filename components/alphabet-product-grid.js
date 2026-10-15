import AlphabetProductBrowser from '@/components/alphabet-product-browser';
import { byEnglishSlug } from '@/content/pages/products';
import { catalogUrl } from '@/content/global';
import { imageSource } from '@/lib/images';
import { localePath } from '@/lib/routes';
import { productCategoryLabel } from '@/lib/product-category-label';
import { allHomeProducts, getLiveCatalogRows, inStockHomeProducts, productKey, rankedHomeProducts } from '@/lib/home-products';

const INITIAL_COUNT = 11;
const slug = (path) => String(path || '').replace(/^\/|\/$/g, '').split('/').pop();

// Only the visible cards are rendered. The full product list is passed as small
// card data for the A–Z controls, avoiding a hundred hidden images in the HTML.
export default async function AlphabetProductGrid({ lang }) {
  const rows = await getLiveCatalogRows();
  const featured = rankedHomeProducts(rows, INITIAL_COUNT);
  const available = inStockHomeProducts(allHomeProducts, rows);
  const products = [...new Map([...featured, ...available]
    .map((product) => [productKey(product.name), product])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const prepare = (product) => ({
    name: product.name,
    price: product.price,
    category: productCategoryLabel(product.category, lang),
    image: imageSource(product.image),
    href: product.href && byEnglishSlug(slug(product.href))
      ? localePath(product.href, lang)
      : null,
  });

  return (
    <AlphabetProductBrowser
      catalogHref={catalogUrl(lang)}
      featured={featured.map(prepare)}
      lang={lang}
      products={products.map(prepare)}
    />
  );
}
