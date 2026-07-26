// Single source of truth for contact details, external links and legal copy.
// Verified against the live site on 2026-07-26.

export const SITE_URL = 'https://peptidescostarica.net';

export const CONTACT = {
  crPhone: '+506 8404-6973',
  crPhoneHref: 'tel:+50684046973',
  usPhone: '+1 (831) 471-5559',
  usPhoneHref: 'tel:+18314715559',
  email: 'info@peptidescostarica.net',
  emailHref: 'mailto:info@peptidescostarica.net',
  whatsappHref: 'https://wa.me/50684046973',
  location: 'Jaco, Costa Rica',
};

// The catalog site is a SEPARATE application (separate private repo) that owns
// the cart, checkout, and orders. This project is marketing only: every buy
// button links out to it. Never reimplement its checkout here.
const CATALOG_BASE = 'https://catalog.peptidescostarica.net/catalog';

/** Catalog URL for a given language. English pages use ?lang=en, Spanish ?lang=es. */
export function catalogUrl(lang = 'en') {
  return `${CATALOG_BASE}?lang=${lang === 'es' ? 'es' : 'en'}`;
}

export const PRESS = {
  outlet: 'The Costa Rica News',
  href: 'https://thecostaricanews.com/introducing-peptides-costa-rica-bringing-trusted-peptide-products-to-costa-rica/',
};

// Must appear in the footer of every page.
export const DISCLAIMER = {
  en: 'Products offered by Peptides Costa Rica are intended strictly for laboratory research use only. They are not approved or licensed by the FDA for the prevention, diagnosis, treatment, or cure of any disease. Information on this website is for educational purposes only and should not be considered medical or legal advice. Not for human or veterinary use.',
  es: 'Los productos ofrecidos por Peptides Costa Rica están destinados estrictamente para uso exclusivo en investigación de laboratorio. No están aprobados ni autorizados por la FDA para la prevención, el diagnóstico, el tratamiento o la cura de ninguna enfermedad. La información de este sitio web tiene únicamente fines educativos y no debe considerarse asesoramiento médico o legal. No apto para uso humano ni veterinario.',
};

export const SOCIAL = [
  { name: 'Facebook', href: 'https://www.facebook.com/' },
  { name: 'Instagram', href: 'https://www.instagram.com/' },
  { name: 'YouTube', href: 'https://www.youtube.com/' },
  { name: 'TikTok', href: 'https://www.tiktok.com/' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/' },
  { name: 'X', href: 'https://x.com/' },
  { name: 'Pinterest', href: 'https://www.pinterest.com/' },
];

/** Prefix a path with /es for Spanish. `/` becomes `/es`. */
export function localePath(path, lang) {
  if (lang !== 'es') return path;
  return path === '/' ? '/es' : `/es${path}`;
}
