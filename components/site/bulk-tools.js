'use client';

import { useMemo, useState } from 'react';
import Ms from '@/components/storefront/icon';
import { useSite } from '@/components/site/site-provider';
import { variantFor } from '@/lib/storefront/group-products.mjs';
import { lineFor, quoteCart } from '@/lib/site/quote.mjs';

/**
 * The bulk-discount page's calculator and examples, and the professional
 * page's price-per-mg rows, on live prices.
 *
 * Volume pricing is quoted by checkout's own function with no deal, because
 * these tools explain the standing volume discount; a running deal is
 * described on its own page and applied in the cart.
 */

function useVolumeQuote() {
  const { currency, exchangeRate } = useSite();
  return (compound, variant, qty) => {
    const quote = quoteCart([lineFor(compound, variant, qty)], { currency, exchangeRate, deal: null });
    const unit = currency === 'USD' ? variant.priceUsd : variant.priceCrc;
    const full = unit * qty;
    const pct = quote ? quote.discountPct : 0;
    return { full, pct, pay: full * (1 - pct), unit };
  };
}

export function BulkCalc({ compounds }) {
  const { t, money, cart, addToCart, setQty, setSheetOpen } = useSite();
  const sellable = useMemo(() => compounds.filter((compound) => compound.shelf !== 'supplies'), [compounds]);
  const [slug, setSlug] = useState(() => (sellable.find((compound) => compound.name === 'GLP-1') || sellable[0])?.slug);
  const compound = sellable.find((entry) => entry.slug === slug) || sellable[0];
  const [size, setSize] = useState(compound?.defaultSize);
  const [qty, setQ] = useState(10);
  const price = useVolumeQuote();
  if (!compound) return null;

  const variant = variantFor(compound, size);
  const n = Math.max(1, Math.min(99, Math.trunc(qty) || 1));
  const { full, pct, pay } = price(compound, variant, n);
  const next = n < 5 ? 5 : n < 10 ? 10 : 0;
  const m = (amount) => money(amount, amount);

  const add = () => {
    if (cart.some((line) => line.product === variant.product)) setQty(variant.product, n);
    else addToCart(compound, variant, n);
    setSheetOpen(true);
  };

  return (
    <div className="calc">
      <div className="cin">
        <h2>{t('Savings calculator')}</h2>
        <label>
          {t('Compound')}
          <select
            value={compound.slug}
            onChange={(event) => {
              const picked = sellable.find((entry) => entry.slug === event.target.value);
              setSlug(picked.slug);
              setSize(picked.defaultSize);
            }}
          >
            {sellable.map((entry) => <option value={entry.slug} key={entry.slug}>{entry.name}</option>)}
          </select>
        </label>
        <label>
          {t('Strength')}
          <select value={variant.size} onChange={(event) => setSize(event.target.value)}>
            {compound.variants.map((entry) => (
              <option value={entry.size} key={entry.product} disabled={!entry.inStock}>{entry.size}</option>
            ))}
          </select>
        </label>
        <label>
          {t('Vials')}
          <div className="qbig">
            <button type="button" aria-label={t('Fewer')} onClick={() => setQ(Math.max(1, n - 1))}>−</button>
            <input type="number" min="1" max="99" inputMode="numeric" value={n} onChange={(event) => setQ(Number(event.target.value))} />
            <button type="button" aria-label={t('More')} onClick={() => setQ(Math.min(99, n + 1))}>+</button>
          </div>
        </label>
        <div className="qpills">
          {[1, 5, 10, 20].map((value) => (
            <button type="button" key={value} onClick={() => setQ(value)}>{value}</button>
          ))}
        </div>
      </div>
      <div className="cout">
        <small>{`${n} × ${compound.name} ${variant.size}`}</small>
        <div className="bigsave">{pct ? <>{`${t('You save')} `}<b>{m(full - pay)}</b></> : t('List price')}</div>
        <div className="rowt"><span>{t('List price')}</span><s className="num">{m(full)}</s></div>
        <div className="rowt"><span>{t('Discount')}</span><span>{pct ? `${Math.round(pct * 100)}%` : '—'}</span></div>
        <div className="rowt tot"><span>{t('You pay')}</span><b className="num">{m(pay)}</b></div>
        <div className="rowt"><span>{t('Per vial')}</span><span className="num">{m(pay / n)}</span></div>
        {next ? (
          <p className="nudge2"><Ms name="savings" />{t(`Add ${next - n} more to unlock ${next === 5 ? '15%' : '20%'} off`)}</p>
        ) : null}
        <button className="btn block" type="button" onClick={add} disabled={!variant.inStock}>
          <Ms name="add_shopping_cart" />
          {t(`Add ${n} to order`)}
        </button>
      </div>
    </div>
  );
}

const EXAMPLES = [['GLP-1', '20 mg', 5], ['GLP-1', '20 mg', 10], ['GHK-Cu', '50 mg', 10], ['Tirzepatide', '30 mg', 5], ['BPC-157', '10 mg', 10]];

export function BulkExamples({ compounds }) {
  const { money } = useSite();
  const price = useVolumeQuote();
  const m = (amount) => money(amount, amount);
  return EXAMPLES.map(([name, size, qty]) => {
    const compound = compounds.find((entry) => entry.name === name);
    if (!compound) return null;
    const variant = variantFor(compound, size);
    const { full, pay } = price(compound, variant, qty);
    return (
      <tr key={`${name}${size}${qty}`}>
        <td><b>{`${qty} × ${name}`}</b>{` ${variant.size}`}</td>
        <td className="num">{m(full)}</td>
        <td className="num"><b>{m(pay)}</b></td>
        <td className="num ok">{m(full - pay)}</td>
      </tr>
    );
  });
}

const PER_MG = [['GLP-1', '5 mg', '60 mg'], ['Tirzepatide', '10 mg', '60 mg'], ['GHK-Cu', '50 mg', '100 mg'], ['NAD+', '500 mg', '1000 mg']];

export function PerMg({ compounds }) {
  const { currency, money } = useSite();
  const m = (amount) => money(amount, amount);
  return PER_MG.map(([name, small, large]) => {
    const compound = compounds.find((entry) => entry.name === name);
    const a = compound?.variants.find((entry) => entry.size === small);
    const b = compound?.variants.find((entry) => entry.size === large);
    if (!a || !b) return null;
    const price = (variant) => (currency === 'USD' ? variant.priceUsd : variant.priceCrc);
    const pa = price(a) / parseFloat(small);
    const pb = price(b) / parseFloat(large);
    return (
      <div className="pmrow" key={name}>
        <b>{name}</b>
        <span>{small} <em className="num">{`${m(pa)}/mg`}</em></span>
        <span className="ar">→</span>
        <span>{large} <em className="num ok">{`${m(pb)}/mg`}</em></span>
        <small>{`−${Math.round((1 - pb / pa) * 100)}%`}</small>
      </div>
    );
  });
}
