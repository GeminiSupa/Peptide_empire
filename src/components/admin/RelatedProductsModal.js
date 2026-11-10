import React, { useMemo, useState } from 'react';

import { relatedKey } from '@/lib/relatedProducts.mjs';

/**
 * Products tab → "Related products": which other products the main website
 * shows on this product's page. See src/lib/relatedProducts.mjs.
 *
 * Styled by the pm-confirm rules in ProductsManager.
 */
const CHOICES = [
  {
    mode: 'auto',
    title: 'Automatic',
    text: 'Other products from the same category, in stock. This is how every product page works today.',
  },
  {
    mode: 'none',
    title: 'None',
    text: 'Show no other products on this page.',
  },
  {
    mode: 'pick',
    title: 'Choose products',
    text: 'Show only the products you tick, in the order you tick them.',
  },
];

export default function RelatedProductsModal({ compoundName, setting, compounds, onClose, onSave }) {
  const [mode, setMode] = useState(setting?.mode || 'auto');
  const [picks, setPicks] = useState(setting?.picks || []);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ownKey = relatedKey(compoundName);
  const options = useMemo(() => {
    const query = search.trim().toLowerCase();
    return compounds
      .filter((entry) => relatedKey(entry.name) !== ownKey)
      .filter((entry) => !query || entry.name.toLowerCase().includes(query));
  }, [compounds, ownKey, search]);

  const pickIndex = (name) => picks.findIndex((pick) => relatedKey(pick) === relatedKey(name));
  const togglePick = (name) => {
    setPicks((current) => (pickIndex(name) === -1
      ? [...current, name]
      : current.filter((pick) => relatedKey(pick) !== relatedKey(name))));
  };

  // A chosen product that no longer exists in the grid (renamed or deleted
  // elsewhere) is listed so it can be unticked.
  const missing = picks.filter((pick) => !compounds.some((entry) => relatedKey(entry.name) === relatedKey(pick)));

  const save = async () => {
    if (mode === 'pick' && picks.length === 0) {
      setError('Tick at least one product, or choose "None".');
      return;
    }
    setSaving(true);
    setError('');
    const result = await onSave(compoundName, { mode, picks: mode === 'pick' ? picks : [] });
    setSaving(false);
    if (result?.error) setError(result.error);
    else onClose();
  };

  return (
    <div className="pm-confirm-overlay pm-confirm-overlay--top" onClick={onClose}>
      <div className="pm-confirm pm-related" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pm-related-title">
        <h3 id="pm-related-title">Related products: {compoundName}</h3>
        <p>
          Which other products the website (peptidescostarica.net) shows on this product&apos;s page,
          under &ldquo;More in …&rdquo; and in &ldquo;Frequently ordered together&rdquo;.
          It applies to every size of {compoundName}.
        </p>

        <div className="pm-related-choices" role="radiogroup" aria-label="Related products">
          {CHOICES.map((choice) => (
            <label key={choice.mode} className={`pm-related-choice${mode === choice.mode ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="pm-related-mode"
                checked={mode === choice.mode}
                onChange={() => { setMode(choice.mode); setError(''); }}
              />
              <span>
                <strong>{choice.title}</strong>
                <em>{choice.text}</em>
              </span>
            </label>
          ))}
        </div>

        {mode === 'pick' && (
          <div className="pm-related-picker">
            <input
              type="search"
              className="admin-input"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            <div className="pm-related-list">
              {missing.map((name) => (
                <label key={`missing-${name}`} className="pm-related-item">
                  <input type="checkbox" checked onChange={() => togglePick(name)} />
                  <span>{name} <em>(no longer in the product list, will not show)</em></span>
                  <b>{pickIndex(name) + 1}</b>
                </label>
              ))}
              {options.map((entry) => {
                const at = pickIndex(entry.name);
                return (
                  <label key={entry.name} className="pm-related-item">
                    <input type="checkbox" checked={at !== -1} onChange={() => togglePick(entry.name)} />
                    <span>
                      {entry.name}
                      {entry.hidden && <em> (hidden, will not show)</em>}
                    </span>
                    {at !== -1 && <b>{at + 1}</b>}
                  </label>
                );
              })}
              {options.length === 0 && missing.length === 0 && <p className="pm-related-empty">No product matches.</p>}
            </div>
            <p className="pm-related-hint">
              {picks.length === 0 ? 'Nothing ticked yet.' : `${picks.length} ticked. Up to 4 show under the page, the first one also in "Frequently ordered together". Out-of-stock products are skipped.`}
            </p>
          </div>
        )}

        <p className="pm-confirm-note">
          The free BAC Water in &ldquo;Frequently ordered together&rdquo; always stays. Saved straight away; the website
          shows the change within about a minute.
        </p>

        {error && <p className="pm-related-error" role="alert">{error}</p>}

        <div className="pm-confirm-actions">
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
