import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import Container from '@/components/ui/container';
import { FOOTER_CATEGORIES, FOOTER_QUICK_LINKS, label } from '@/lib/nav';
import {
  CONTACT,
  DISCLAIMER,
  SOCIAL,
  catalogUrl,
  localePath,
} from '@/lib/site';

const COPY = {
  en: {
    blurb:
      'Peptides Costa Rica offers premium, research-backed peptides for weight loss, muscle growth, energy, recovery, and healthy aging — with trusted quality and bulk savings across Costa Rica.',
    legal: 'Legal Notice',
    quick: 'Quick Links',
    categories: 'Shop By Categories',
    viewAll: 'View All',
    contact: 'Contact Us',
    rights: 'All Rights Reserved.',
  },
  es: {
    blurb:
      'Peptides Costa Rica ofrece péptidos premium respaldados por investigación para pérdida de peso, crecimiento muscular, energía, recuperación y envejecimiento saludable, con calidad confiable y ahorros por volumen en todo Costa Rica.',
    legal: 'Aviso Legal',
    quick: 'Enlaces Rápidos',
    categories: 'Comprar Por Categorías',
    viewAll: 'Ver Todo',
    contact: 'Contáctenos',
    rights: 'Todos Los Derechos Reservados.',
  },
};

export default function SiteFooter({ lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-primary text-white/85">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand + legal */}
          <div className="lg:col-span-1">
            <p className="text-lg font-extrabold text-white">Peptides Costa Rica</p>
            <p className="mt-4 text-sm leading-relaxed">{t.blurb}</p>
            <div className="mt-6">
              <p className="text-xs font-bold tracking-wider text-white uppercase">
                {t.legal}
              </p>
              {/* Required on every page. */}
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {DISCLAIMER[lang] || DISCLAIMER.en}
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-sm font-bold tracking-wider text-white uppercase">
              {t.quick}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {FOOTER_QUICK_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={localePath(item.href, lang)}
                    className="hover:text-white hover:underline"
                  >
                    {label(item, lang)}
                  </Link>
                </li>
              ))}
              <li>
                <a href={catalogUrl(lang)} className="hover:text-white hover:underline">
                  Catalog
                </a>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <p className="text-sm font-bold tracking-wider text-white uppercase">
              {t.categories}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {FOOTER_CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={localePath(c.slug, lang)}
                    className="hover:text-white hover:underline"
                  >
                    {label(c, lang)}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={localePath('/all-peptide-products-costa-rica/', lang)}
                  className="font-semibold text-white hover:underline"
                >
                  {t.viewAll}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-bold tracking-wider text-white uppercase">
              {t.contact}
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={CONTACT.emailHref}
                  className="inline-flex items-center gap-2 break-all hover:text-white hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {CONTACT.email}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.crPhoneHref}
                  className="inline-flex items-center gap-2 hover:text-white hover:underline"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  CR {CONTACT.crPhone}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.usPhoneHref}
                  className="inline-flex items-center gap-2 hover:text-white hover:underline"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  US {CONTACT.usPhone}
                </a>
              </li>
              <li className="pt-1 text-white/70">{CONTACT.location}</li>
            </ul>

            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {SOCIAL.map((s) => (
                <li key={s.name}>
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
          Copyright © {year} Peptides Costa Rica, {t.rights}
        </div>
      </Container>
    </footer>
  );
}
