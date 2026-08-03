import Link from 'next/link';
import { ChevronDown, Phone, ShoppingCart } from 'lucide-react';
import Container from '@/components/ui/container';
import Logo from '@/components/logo';
import MobileMenu from '@/components/mobile-menu';
import HeaderSearch from '@/components/header-search';
import { announcement, headerContact, nav, catalogUrl, ui } from '@/content/global';
import { searchIndex } from '@/lib/search-index';
import { label, t } from '@/lib/i18n';
import { alternatePath, localePath, DEFAULT_LANG } from '@/lib/routes';

// The only strings that live in code are UI affordances with no equivalent on
// the live site's markup (the shop button and the language toggle labels).
// Everything a visitor reads as content comes from content/global.js.
const UI = {
  es: { shop: 'Comprar Ahora', switchTo: 'English' },
  en: { shop: 'Shop Now', switchTo: 'Español' },
};

export default function SiteHeader({ lang = DEFAULT_LANG, path = '/' }) {
  const labels = UI[lang] || UI[DEFAULT_LANG];
  const lp = (href) => localePath(href, lang);
  const index = searchIndex(lang);

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Announcement bar */}
      <div className="bg-primary text-white">
        <Container className="flex flex-col items-center justify-between gap-1 py-2 text-center text-xs sm:flex-row sm:text-left sm:text-[13px]">
          <p className="font-medium">{t(announcement, 'text', lang)}</p>
          <div className="flex items-center gap-4">
            {headerContact.map((c) => (
              <a
                key={c.href}
                href={c.href}
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {label(c, lang)}
              </a>
            ))}
          </div>
        </Container>
      </div>

      {/* Main bar */}
      <Container className="flex items-center justify-between gap-4 py-3">
        <Logo lang={lang} />

        <nav className="hidden lg:block" aria-label="Main">
          <ul className="flex items-center gap-1">
            {nav.map((item) => {
              const text = label(item, lang);
              const hasChildren = item.children.length > 0;

              return (
                <li key={text} className="group relative">
                  {item.href ? (
                    <Link
                      href={lp(item.href)}
                      className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-bold tracking-wide text-primary uppercase hover:text-accent"
                    >
                      {text}
                      {hasChildren && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                    </Link>
                  ) : (
                    <span className="inline-flex cursor-default items-center gap-1 rounded-md px-3 py-2 text-[13px] font-bold tracking-wide text-primary uppercase group-hover:text-accent">
                      {text}
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  )}

                  {hasChildren && (
                    <div className="invisible absolute top-full left-0 z-50 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      {/* SHOP BY PRODUCT has 40 children on the live site, so
                          long lists become a scrollable multi-column panel. */}
                      <ul
                        className={`max-h-[70vh] overflow-y-auto rounded-lg border border-slate-100 bg-white py-2 shadow-lg ${
                          item.children.length > 12
                            ? 'grid w-[560px] grid-cols-2 gap-x-2'
                            : 'min-w-[250px]'
                        }`}
                      >
                        {item.children.map((child) => (
                          <li key={`${child.href}-${child.label_en}`}>
                            <Link
                              href={lp(child.href)}
                              className="block px-4 py-2 text-sm text-text-main hover:bg-slate-50 hover:text-accent"
                            >
                              {label(child, lang)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden xl:block">
            <HeaderSearch index={index} lang={lang} />
          </div>

          <Link
            href={alternatePath(path, lang)}
            className="hidden rounded-md px-2 py-1 text-xs font-semibold text-text-muted hover:text-primary sm:inline-block"
          >
            {labels.switchTo}
          </Link>

          {/* Currency indicator, deliberately NOT a switcher.
              The live site converts prices with a WooCommerce plugin. Prices
              here are a harvest-time snapshot in CRC, so a control that
              relabelled them as USD without converting would show visitors
              wrong prices — worse than not offering the choice. Shown as the
              site's currency; the catalog site remains where anyone transacts. */}
          <span
            className="hidden items-center rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-text-main lg:inline-flex"
            title="Prices shown in Costa Rican colón"
          >
            ₡ CRC
          </span>

          {/* The cart lives on the catalog site; this links there rather than
              rendering a basket that can never fill. No count is shown for the
              same reason — a permanent "0" would be a broken control. */}
          <a
            aria-label={t(ui, 'cart', lang)}
            className="hidden items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:border-primary lg:inline-flex"
            href={catalogUrl(lang)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ShoppingCart aria-hidden="true" className="h-4 w-4" />
            {t(ui, 'cart', lang)}
          </a>
          <a
            href={catalogUrl(lang)}
            className="hidden rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:inline-flex"
          >
            {labels.shop}
          </a>
          <MobileMenu lang={lang} path={path} />
        </div>
      </Container>
    </header>
  );
}
