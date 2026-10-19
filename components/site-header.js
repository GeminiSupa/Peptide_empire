import Link from 'next/link';
import { Check, ChevronDown, Mail, MapPin, Phone, ShoppingCart } from 'lucide-react';
import Container from '@/components/ui/container';
import Logo from '@/components/logo';
import WhatsAppIcon from '@/components/whatsapp-icon';
import MobileMenu from '@/components/mobile-menu';
import HeaderSearch from '@/components/header-search';
import { catalogUrl, ui } from '@/content/global';
import { getPublishedGlobal } from '@/lib/site-cms';
import { searchIndex } from '@/lib/search-index';
import { label, t } from '@/lib/i18n';
import { alternatePath, localePath, DEFAULT_LANG } from '@/lib/routes';
import StructuredData from '@/components/structured-data';

// The only strings that live in code are UI affordances with no equivalent on
// the live site's markup (the shop button and the language toggle labels).
// Everything a visitor reads as content comes from content/global.js.
// The live header has no "Shop Now" button — that was invented here and has
// been removed. Only the language toggle label remains, which the live site
// renders as a flag rather than text.
const UI = {
  es: { current: 'Español', switchTo: 'English' },
  en: { current: 'English', switchTo: 'Español' },
};

export default async function SiteHeader({ lang = DEFAULT_LANG, path = '/' }) {
  const { announcement, headerContact, nav } = await getPublishedGlobal();
  const labels = UI[lang] || UI[DEFAULT_LANG];
  const lp = (href) => localePath(href, lang);
  const index = searchIndex(lang);

  return (
    <>
      <StructuredData path={path} />
      <header className="relative z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_4px_18px_rgba(9,39,113,0.06)] backdrop-blur">
      {/* Announcement bar */}
      <div className="bg-primary text-white">
        <Container className="flex items-center justify-between gap-2 py-1.5 text-left text-[10px] sm:py-2 sm:text-[13px]">
          <p className="inline-flex min-w-0 flex-1 items-center gap-1.5 leading-tight font-medium uppercase">
            <MapPin aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
            {t(announcement, 'text', lang)}
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              className="hidden items-center gap-1.5 font-medium hover:underline sm:inline-flex"
              href={lp('/contact-costa-rica/')}
            >
              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
              {t(ui, 'contactUs', lang)}
            </Link>

            {headerContact.map((c, i) => (
              <a
                className={`contact-cta ${i > 0 ? 'hidden sm:inline-flex' : 'inline-flex'} items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap sm:px-3.5 sm:py-2 sm:text-[13px]`}
                href={c.href}
                key={c.href}
                rel={c.href.startsWith('https://wa.me/') ? 'noopener noreferrer' : undefined}
                target={c.href.startsWith('https://wa.me/') ? '_blank' : undefined}
              >
                {c.href.startsWith('https://wa.me/')
                  ? <WhatsAppIcon className="h-[18px] w-[18px] shrink-0" />
                  : <Phone aria-hidden="true" className="h-4 w-4" />}
                {label(c, lang)}
              </a>
            ))}
          </div>
        </Container>
      </div>

      {/* Main bar */}
      <Container className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
        <Logo lang={lang} />

        <nav className={lang === 'es' ? 'hidden min-[1200px]:block' : 'hidden lg:block'} aria-label={lang === 'es' ? 'Principal' : 'Main'}>
          <ul className="flex items-center gap-1">
            {nav.map((item) => {
              const text = label(item, lang);
              const hasChildren = item.children.length > 0;

              return (
                <li key={text} className="group relative">
                  {item.href ? (
                    <Link
                      href={lp(item.href)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[13px] font-bold whitespace-nowrap text-primary uppercase transition hover:bg-primary/5 hover:text-accent"
                    >
                      {text}
                      {hasChildren && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                    </Link>
                  ) : (
                    <span className="inline-flex cursor-default items-center gap-1 rounded-md px-2.5 py-2 text-[13px] font-bold whitespace-nowrap text-primary uppercase transition group-hover:bg-primary/5 group-hover:text-accent">
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

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden xl:block">
            <HeaderSearch index={index} lang={lang} />
          </div>

          <LanguageDropdown lang={lang} labels={labels} path={path} />

          {/* Currency indicator, deliberately NOT a switcher.
              The live site converts prices with a WooCommerce plugin. Prices
              here are a harvest-time snapshot in CRC, so a control that
              relabelled them as USD without converting would show visitors
              wrong prices — worse than not offering the choice. Shown as the
              site's currency; the catalog site remains where anyone transacts. */}
          <span
            className="hidden items-center rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-text-main lg:inline-flex"
            title={lang === 'es' ? 'Precios en colones costarricenses' : 'Prices shown in Costa Rican colón'}
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
          <MobileMenu lang={lang} path={path} nav={nav} headerContact={headerContact} />
        </div>
      </Container>
      </header>
    </>
  );
}

function LanguageDropdown({ lang, labels, path }) {
  const currentCode = lang === 'es' ? 'es' : 'en';
  const alternateCode = lang === 'es' ? 'en' : 'es';

  return (
    <details className="group relative hidden sm:block">
      <summary
        aria-label={lang === 'es' ? 'Elegir idioma' : 'Choose language'}
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 transition hover:border-slate-200 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
        title={lang === 'es' ? 'Elegir idioma' : 'Choose language'}
      >
        <Flag code={currentCode} />
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 text-primary transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="absolute top-full right-0 z-50 mt-2 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl">
        <div className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-primary">
          <Flag code={currentCode} />
          <span className="flex-1">{labels.current}</span>
          <Check aria-hidden="true" className="h-4 w-4 text-accent" />
        </div>
        <Link
          href={alternatePath(path, lang)}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-main transition hover:bg-slate-50 hover:text-primary"
          hrefLang={alternateCode}
        >
          <Flag code={alternateCode} />
          <span>{labels.switchTo}</span>
        </Link>
      </div>
    </details>
  );
}

/** The language switcher on the live header is a pair of flags, not a word. */
function Flag({ code }) {
  if (code === 'es') {
    return (
      <svg aria-hidden="true" className="h-3.5 w-[18px] rounded-[2px] shadow-sm" viewBox="0 0 18 14">
        <rect fill="#002B7F" height="14" width="18" />
        <rect fill="#fff" height="8" width="18" y="3" />
        <rect fill="#CE1126" height="4" width="18" y="5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="h-3.5 w-[18px] rounded-[2px] shadow-sm" viewBox="0 0 18 14">
      <rect fill="#BF0A30" height="14" width="18" />
      <rect fill="#fff" height="2" width="18" y="2" />
      <rect fill="#fff" height="2" width="18" y="6" />
      <rect fill="#fff" height="2" width="18" y="10" />
      <rect fill="#002868" height="7" width="8" />
    </svg>
  );
}
