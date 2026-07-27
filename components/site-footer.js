import Link from 'next/link';
import { Mail } from 'lucide-react';
import Container from '@/components/ui/container';
import { footer } from '@/content/global';
import { label, t } from '@/lib/i18n';
import { localePath, DEFAULT_LANG } from '@/lib/routes';

// Column headings are the live site's own words, harvested in both languages.
const HEADINGS = {
  es: { quick: 'Enlaces rápidos', categories: 'Comprar por categorías', contact: 'Contáctenos', legal: 'Aviso legal:' },
  en: { quick: 'Quick Links', categories: 'Shop By Categories', contact: 'Contact Us', legal: 'Legal Notice:' },
};

export default function SiteFooter({ lang = DEFAULT_LANG }) {
  const h = HEADINGS[lang] || HEADINGS[DEFAULT_LANG];
  const lp = (href) => localePath(href, lang);

  return (
    <footer className="mt-auto bg-primary text-white/85">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand + legal */}
          <div>
            <p className="text-lg font-extrabold text-white">Peptides Costa Rica</p>
            <p className="mt-4 text-sm leading-relaxed">{t(footer, 'blurb', lang)}</p>
            <div className="mt-6">
              <p className="text-xs font-bold tracking-wider text-white uppercase">{h.legal}</p>
              {/* Required on every page. */}
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {t(footer, 'disclaimer', lang)}
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-sm font-bold tracking-wider text-white uppercase">{h.quick}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footer.quickLinks.map((item) => (
                <li key={`${item.href}-${item.label_en}`}>
                  <Link href={lp(item.href)} className="hover:text-white hover:underline">
                    {label(item, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <p className="text-sm font-bold tracking-wider text-white uppercase">{h.categories}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footer.categories.map((c) => (
                <li key={`${c.href}-${c.label_en}`}>
                  <Link href={lp(c.href)} className="hover:text-white hover:underline">
                    {label(c, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + social */}
          <div>
            <p className="text-sm font-bold tracking-wider text-white uppercase">{h.contact}</p>
            <ul className="mt-4 space-y-3 text-sm">
              {footer.contactLinks.map((c) => (
                <li key={c.href}>
                  <a
                    href={c.href}
                    className="inline-flex items-center gap-2 break-all hover:text-white hover:underline"
                  >
                    {c.href.startsWith('mailto:') && (
                      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    {label(c, lang)}
                  </a>
                </li>
              ))}
            </ul>

            {/* Eight real profiles, harvested from the live footer. */}
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {footer.social.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    className="hover:text-white hover:underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6 text-center text-xs text-white/60">
          {t(footer, 'copyright', lang)}
        </div>
      </Container>
    </footer>
  );
}
