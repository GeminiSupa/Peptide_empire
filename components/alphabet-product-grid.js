import ProductCard from '@/components/product-card';
import currentProducts from '@/data/home-catalog-products.json';
import storeData from '@/data/wp/store-products.json';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const INITIAL_COUNT = 11;

const letterOf = (name) => {
  const match = String(name || '').toUpperCase().match(/[A-Z]/);
  return match?.[0] || 'A';
};

/**
 * The live homepage's A–Z product browser.
 *
 * The WordPress version is a shortcode, so it was skipped by the Elementor
 * tree harvester while a hidden, obsolete tab widget was copied instead. This
 * keeps the live first page verbatim and folds in the harvested store catalog
 * so every letter remains useful. All cards stay in the HTML for indexing;
 * the radio controls only change which ones CSS displays.
 */
export default function AlphabetProductGrid({ content, lang, id = 'home-products-az' }) {
  const tabProducts = (content.items ?? []).flatMap((item) =>
    (item.products ?? []).map((product) => ({
      ...product,
      category: product.category || item.label_en,
    })),
  );
  const storeProducts = (storeData.products ?? []).map((product) => ({
    name: product.name,
    price: product.price,
    href: `/product/${product.slug}/`,
    image: product.images?.[0],
    category: product.categories?.[0]?.name,
  }));

  const seen = new Set();
  const products = [...currentProducts, ...tabProducts, ...storeProducts].filter((product) => {
    const key = product.href || `${product.name}-${product.price}`;
    if (!product.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rules = LETTERS.map(
    (letter) => `
#${id}-${letter}:checked ~ .az-grid .az-card:not(.az-${letter}) { display: none; }
#${id}-${letter}:checked ~ .az-controls label[for="${id}-${letter}"] {
  background: #092771;
  color: #fff;
}`,
  ).join('\n');

  return (
    <div id={id}>
      <style>{`
#${id} .az-radio { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
#${id}-ALL:checked ~ .az-grid .az-overflow { display:none; }
#${id}-ALL:checked ~ .az-controls label[for="${id}-ALL"] { background:#cf2e2e; color:#fff; }
${rules}`}</style>

      <p className="mt-6 text-sm font-semibold text-primary">
        {lang === 'es' ? 'Filtrar por alfabeto' : 'Filter by Alphabet'}
      </p>

      <input className="az-radio" defaultChecked id={`${id}-ALL`} name={id} type="radio" />
      {LETTERS.map((letter) => (
        <input className="az-radio" id={`${id}-${letter}`} key={letter} name={id} type="radio" />
      ))}

      <div className="az-controls mt-3 flex flex-wrap gap-1.5">
        {['ALL', ...LETTERS].map((letter) => (
          <label
            className="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-red"
            htmlFor={`${id}-${letter}`}
            key={letter}
          >
            {letter}
          </label>
        ))}
      </div>

      <div className="az-grid mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product, index) => {
          const letter = letterOf(product.name);
          return (
            <div
              className={`az-card az-${letter} ${index >= INITIAL_COUNT ? 'az-overflow' : ''}`}
              key={`${product.href}-${product.price}-${index}`}
            >
              <ProductCard lang={lang} product={product} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
