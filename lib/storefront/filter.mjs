// Searching, filtering and sorting the shelf. Pure, so the unit tests can
// drive it without a browser.

import { shelfLabel, SHELF_IDS } from './shelves.mjs';

export const SORTS = ['pop', 'low', 'high', 'az'];

/**
 * Apply the rail's controls to the catalog.
 *
 * @param {Array} compounds  from the feed
 * @param {{shelf: string, query: string, sort: string, inStockOnly: boolean}} state
 * @param {string} lang      so a Spanish shopper can search Spanish shelf names
 */
export function applyFilters(compounds, state, lang = 'en') {
  const { shelf = 'all', query = '', sort = 'pop', inStockOnly = false } = state || {};
  const needle = String(query).trim().toLowerCase();

  const matched = (compounds || []).filter((compound) => {
    if (shelf === 'best' && !compound.best) return false;
    if (shelf !== 'all' && shelf !== 'best' && compound.shelf !== shelf) return false;
    if (inStockOnly && !compound.inStock) return false;

    if (needle) {
      // Searchable: the name, the shelf it sits on, and every strength — so
      // "20 mg", "glp" and "metabolic" all find GLP-1.
      const haystack = [
        compound.name,
        compound.storedName,
        shelfLabel(compound.shelf, lang),
        shelfLabel(compound.shelf, 'en'),
        compound.variants.map((variant) => variant.size).join(' '),
      ].join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const cheapest = (compound) => compound.fromPriceUsd;

  const sorted = [...matched];
  if (sort === 'low') sorted.sort((a, b) => cheapest(a) - cheapest(b));
  else if (sort === 'high') sorted.sort((a, b) => cheapest(b) - cheapest(a));
  else if (sort === 'az') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else {
    // "Most popular": best sellers first, then the catalog's own display
    // order, which is what `priority` is for.
    sorted.sort((a, b) => (
      Number(b.best) - Number(a.best)
      || a.priority - b.priority
      || a.name.localeCompare(b.name)
    ));
  }

  return sorted;
}

/**
 * The shelf chips, with a count each. Only shelves that actually hold
 * something are offered — an empty shelf is a dead end.
 */
export function shelfChips(compounds, lang = 'en') {
  const counts = new Map();
  for (const compound of compounds || []) {
    counts.set(compound.shelf, (counts.get(compound.shelf) || 0) + 1);
  }

  const chips = [{ id: 'all', label: 'All', count: (compounds || []).length }];
  const bestCount = (compounds || []).filter((compound) => compound.best).length;
  if (bestCount) chips.push({ id: 'best', label: 'Best sellers', count: null });

  for (const id of SHELF_IDS) {
    const count = counts.get(id);
    if (count) chips.push({ id, label: shelfLabel(id, lang), count, translated: true });
  }

  return chips;
}
