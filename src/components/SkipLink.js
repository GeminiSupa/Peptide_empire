'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { safeLocalStorage as localStorage } from '@/lib/storage';

// The keyboard "skip to content" link. It sits in the shared layout, which is
// rendered on the server and cannot know the shopper's language, so it reads the
// address (?lang=es) or the language the catalog saved, and switches after the
// page loads. The path is a dependency so it is re-read when the shopper moves
// to another page, because the layout is not rebuilt on those moves.
export default function SkipLink() {
  const [lang, setLang] = useState('en');
  const pathname = usePathname();

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    const chosen = fromUrl === 'es' || fromUrl === 'en' ? fromUrl : localStorage.getItem('lang');
    setLang(chosen === 'es' ? 'es' : 'en');
  }, [pathname]);

  return (
    <a className="skip-link" href="#main-content">
      {lang === 'es' ? 'Saltar al contenido principal' : 'Skip to main content'}
    </a>
  );
}
