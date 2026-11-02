'use client';

import { useState } from 'react';
import Ms from '@/components/storefront/icon';

/**
 * The prototype's accordion. Answers are in the markup from the start, so
 * every question and answer is in the page source; only their visibility is
 * toggled. Each item opens on its own, as in the design.
 */
export default function Faq({ items }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (index) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  return (
    <div className="faq">
      {items.map(([question, answer], index) => (
        <div className={`acc${open.has(index) ? ' open' : ''}`} key={question}>
          <button type="button" aria-expanded={open.has(index)} onClick={() => toggle(index)}>
            {question}
            <Ms name="expand_more" />
          </button>
          <div className="body"><p>{answer}</p></div>
        </div>
      ))}
    </div>
  );
}
