'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { t } from '@/lib/i18n';
import { ui } from '@/content/global';

/**
 * Header search.
 *
 * The live site runs a WordPress search plugin against its database. There is
 * no database here, so this searches the harvested page index instead —
 * title-matching across every page the site actually has, resolved at build
 * time and filtered in the browser.
 *
 * That makes it a REAL control rather than a decorative box: a dead input that
 * looks like search would be worse than no search at all.
 */
export default function HeaderSearch({ lang, index = [] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const searchInput = useRef(null);

  useEffect(() => {
    if (open) searchInput.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return index
      .filter((entry) => entry.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, index]);

  return (
    <div className="relative" ref={root}>
      <button
        aria-controls="site-search-panel"
        aria-expanded={open}
        aria-label={t(ui, 'searchPlaceholder', lang)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-primary shadow-sm transition hover:border-primary"
        onClick={() => setOpen((value) => !value)}
        ref={trigger}
        type="button"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-[min(90vw,320px)] rounded-lg border border-slate-200 bg-white p-2 shadow-xl" id="site-search-panel">
          <label className="sr-only" htmlFor="site-search">
            {t(ui, 'searchPlaceholder', lang)}
          </label>
          <input
            autoComplete="off"
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary"
            id="site-search"
            ref={searchInput}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(ui, 'searchPlaceholder', lang)}
            type="search"
            value={query}
          />
          {results.length > 0 && (
            <ul className="mt-1 max-h-80 overflow-y-auto py-1">
              {results.map((entry) => (
                <li key={entry.href}>
                  <Link
                    className="block rounded px-3 py-2 text-sm text-text-main hover:bg-slate-50 hover:text-accent"
                    href={entry.href}
                    onClick={() => { setQuery(''); setOpen(false); }}
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
