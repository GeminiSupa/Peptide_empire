'use client';

import { useCallback, useState } from 'react';
import ProductCard from '@/components/storefront/product-card';
import { useSite } from '@/components/site/site-provider';

/**
 * A grid of product cards that can be added to the order in place, as on
 * the prototype's home, category and catalog views.
 */
export default function ProductGrid({ compounds, id, className = 'grid' }) {
  const { t, lang, money, cart, addToCart, setQty, whatsapp, flashPriceFor } = useSite();
  const [sizes, setSizes] = useState({});
  const onSelectSize = useCallback((slug, size) => setSizes((current) => ({ ...current, [slug]: size })), []);

  return (
    <div className={className} id={id}>
      {compounds.map((compound) => {
        const size = sizes[compound.slug];
        const variant = compound.variants.find((entry) => entry.size === (size || compound.defaultSize));
        const line = variant ? cart.find((entry) => entry.product === variant.product) : null;
        return (
          <ProductCard
            key={compound.slug}
            compound={compound}
            selectedSize={size}
            onSelectSize={onSelectSize}
            inCartQty={line?.qty || 0}
            onAdd={addToCart}
            onChangeQty={setQty}
            money={money}
            t={t}
            lang={lang}
            href={compound.href}
            whatsappFor={whatsapp}
            flashPrice={flashPriceFor(compound, variant)}
          />
        );
      })}
    </div>
  );
}
