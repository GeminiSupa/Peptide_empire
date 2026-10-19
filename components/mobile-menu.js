'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { nav, headerContact, CONTACT, catalogUrl } from '@/content/global';
import { label } from '@/lib/i18n';
import { alternatePath, localePath, DEFAULT_LANG } from '@/lib/routes';

const UI = {
  es: { menu: 'Menú', open: 'Abrir menú', close: 'Cerrar menú', shop: 'Comprar Ahora', switchTo: 'English' },
  en: { menu: 'Menu', open: 'Open menu', close: 'Close menu', shop: 'Shop Now', switchTo: 'Español' },
};

export default function MobileMenu({ lang = DEFAULT_LANG, path = '/' }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [mounted, setMounted] = useState(false);
  const ui = UI[lang] || UI[DEFAULT_LANG];
  const visibility = lang === 'es' ? 'min-[1200px]:hidden' : 'lg:hidden';

  useEffect(() => setMounted(true), []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-primary shadow-sm transition hover:bg-slate-50 ${visibility}`}
        aria-label={ui.open}
        aria-expanded={open}
      >
        <Menu className="h-6 w-6" />
      </button>

      {mounted && open && createPortal(
        <div className={`fixed inset-0 z-[9999] ${visibility}`} role="presentation">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(90vw,24rem)] flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="text-sm font-bold tracking-wide text-primary uppercase">
                {ui.menu}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-primary"
                aria-label={ui.close}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label={ui.menu}>
              <ul className="space-y-1">
                {nav.map((item, i) => {
                  const text = label(item, lang);
                  const hasChildren = item.children.length > 0;
                  const isOpen = expanded === i;

                  return (
                    <li key={text}>
                      <div className="flex items-center">
                        {item.href ? (
                          <Link
                            href={localePath(item.href, lang)}
                            onClick={() => setOpen(false)}
                            className="flex-1 rounded-md px-3 py-3 text-sm font-bold tracking-wide text-primary uppercase hover:bg-slate-50"
                          >
                            {text}
                          </Link>
                        ) : (
                          <span className="flex-1 px-3 py-3 text-sm font-bold tracking-wide text-primary uppercase">
                            {text}
                          </span>
                        )}
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : i)}
                            className="rounded-md p-2 text-primary"
                            aria-label={lang === 'es' ? `Submenú de ${text}` : `${text} submenu`}
                            aria-expanded={isOpen}
                          >
                            <ChevronDown
                              className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        )}
                      </div>

                      {hasChildren && isOpen && (
                        <ul className="mt-1 mb-2 space-y-0.5 border-l-2 border-slate-100 pl-3">
                          {item.children.map((child) => (
                            <li key={`${child.href}-${child.label_en}`}>
                              <Link
                                href={localePath(child.href, lang)}
                                onClick={() => setOpen(false)}
                                className="block rounded-md px-3 py-2.5 text-sm text-text-main hover:bg-slate-50"
                              >
                                {label(child, lang)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="shrink-0 border-t border-slate-200 p-4">
              <a
                href={catalogUrl(lang)}
                className="flex w-full items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-bold text-white shadow-sm"
              >
                {ui.shop}
              </a>
              <Link
                href={alternatePath(path, lang)}
                onClick={() => setOpen(false)}
                className="mt-3 flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-primary"
              >
                {ui.switchTo}
              </Link>
              <div className="mt-4 space-y-1 text-sm text-text-muted">
                {headerContact.map((c) => (
                  <a key={c.href} href={c.href} className="block">
                    {label(c, lang)}
                  </a>
                ))}
                <a href={CONTACT.emailHref} className="block break-all">
                  {CONTACT.email}
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
