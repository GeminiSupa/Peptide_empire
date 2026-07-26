'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FaqAccordion({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="mx-auto mt-10 max-w-3xl divide-y divide-slate-200 rounded-xl border border-slate-200 bg-bg-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
              >
                <span className="text-base font-bold text-primary">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-accent transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </h3>
            {isOpen && (
              <div id={`faq-panel-${i}`} className="px-5 pb-5">
                <p className="text-sm leading-relaxed text-text-muted">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
