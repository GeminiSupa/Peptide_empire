'use client';

import { useEffect, useState } from 'react';
import { ADMIN_SITES, allowedSitesFor } from '@/lib/sites.mjs';

const COOKIE = 'pe_admin_site';

function readCookie() {
  if (typeof document === 'undefined') return '';
  const hit = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE}=`));
  return hit ? decodeURIComponent(hit.split('=')[1]) : '';
}

function writeCookie(value) {
  // One year, site-wide, so every admin page and API call in this browser
  // works in the same country until the person switches again.
  document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * The country the admin is working in. Staff see only the countries their
 * profile allows; a superadmin sees all of them plus an "All countries" view.
 * Changing it stores the choice in a cookie that rides every admin request and
 * reloads, so the whole screen re-reads data for that country.
 *
 * With only one country available (and not a superadmin) there is nothing to
 * switch, so it renders a plain label instead of a dropdown.
 */
export default function CountrySwitcher({ profile }) {
  const [value, setValue] = useState('');
  const allowed = allowedSitesFor(profile);
  const options = ADMIN_SITES.filter((s) => allowed.includes(s.id));
  const isSuper = Boolean(profile?.is_superadmin);

  useEffect(() => {
    const cookie = readCookie();
    setValue(cookie && (cookie === 'all' || allowed.includes(cookie)) ? cookie : (allowed[0] || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id]);

  if (!options.length) return null;

  const onChange = (next) => {
    setValue(next);
    writeCookie(next);
    window.location.reload();
  };

  // Nothing to choose: one country and no "All" view.
  if (options.length === 1 && !isSuper) {
    const only = options[0];
    return (
      <span className="country-switcher country-switcher--locked" title="Your country">
        <span aria-hidden="true">{only.flag}</span> {only.name}
      </span>
    );
  }

  return (
    <label className="country-switcher" title="Country you are working in">
      <span className="country-switcher__icon" aria-hidden="true">
        {value === 'all' ? '🌎' : (ADMIN_SITES.find((s) => s.id === value)?.flag || '🏳️')}
      </span>
      <select
        aria-label="Country"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {isSuper && <option value="all">All countries</option>}
        {options.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
}
