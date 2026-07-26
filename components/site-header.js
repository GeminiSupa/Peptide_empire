import Link from 'next/link';
import { ChevronDown, Phone } from 'lucide-react';
import Container from '@/components/ui/container';
import Logo from '@/components/logo';
import MobileMenu from '@/components/mobile-menu';
import { MAIN_NAV, label } from '@/lib/nav';
import { CONTACT, catalogUrl, localePath } from '@/lib/site';

const COPY = {
  en: {
    shipping: 'FREE Shipping On Orders Above $200 / ₡90,896',
    shop: 'Shop Now',
    switchTo: 'Español',
  },
  es: {
    shipping: 'Envío GRATIS En Pedidos Superiores A $200 / ₡90,896',
    shop: 'Comprar Ahora',
    switchTo: 'English',
  },
};

export default function SiteHeader({ lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  // The language toggle swaps between / and /es for the same page. Home only
  // for now; deeper pages get their own mapping as they're built.
  const otherLang = lang === 'es' ? 'en' : 'es';

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Announcement bar */}
      <div className="bg-primary text-white">
        <Container className="flex flex-col items-center justify-between gap-1 py-2 text-center text-xs sm:flex-row sm:text-left sm:text-[13px]">
          <p className="font-medium">{t.shipping}</p>
          <div className="flex items-center gap-4">
            <a href={CONTACT.crPhoneHref} className="inline-flex items-center gap-1.5 hover:underline">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              CR {CONTACT.crPhone}
            </a>
            <a href={CONTACT.usPhoneHref} className="hidden hover:underline sm:inline">
              US {CONTACT.usPhone}
            </a>
          </div>
        </Container>
      </div>

      {/* Main bar */}
      <Container className="flex items-center justify-between gap-4 py-3">
        <Logo lang={lang} />

        <nav className="hidden lg:block" aria-label="Main">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => {
              const text = label(item, lang);
              const hasChildren = item.children?.length > 0;

              return (
                <li key={text} className="group relative">
                  {item.href ? (
                    <Link
                      href={localePath(item.href, lang)}
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
                      <ul className="min-w-[250px] rounded-lg border border-slate-100 bg-white py-2 shadow-lg">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={localePath(child.href, lang)}
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

        <div className="flex items-center gap-2">
          <Link
            href={otherLang === 'es' ? '/es' : '/'}
            className="hidden rounded-md px-2 py-1 text-xs font-semibold text-text-muted hover:text-primary sm:inline-block"
          >
            {t.switchTo}
          </Link>
          <a
            href={catalogUrl(lang)}
            className="hidden rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:inline-flex"
          >
            {t.shop}
          </a>
          <MobileMenu lang={lang} />
        </div>
      </Container>
    </header>
  );
}
