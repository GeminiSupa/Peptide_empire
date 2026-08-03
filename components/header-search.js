'use client';

import { useMemo, useState } from 'react';
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return index
      .filter((entry) => entry.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, index]);

  return (
    <div className="relative w-full max-w-sm">
      <label className="sr-only" htmlFor="site-search">
        {t(ui, 'searchPlaceholder', lang)}
      </label>
      <div className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 focus-within:border-primary">
        <input
          autoComplete="off"
          className="w-full bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted"
          id="site-search"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(ui, 'searchPlaceholder', lang)}
          type="search"
          value={query}
        />
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
      </div>

      {results.length > 0 && (
        <ul className="absolute top-full left-0 z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {results.map((entry) => (
            <li key={entry.href}>
              <Link
                className="block px-4 py-2 text-sm text-text-main hover:bg-slate-50 hover:text-accent"
                href={entry.href}
                onClick={() => setQuery('')}
              >
                {entry.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
