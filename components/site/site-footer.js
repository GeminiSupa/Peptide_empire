import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import WhatsAppGlyph from '@/components/storefront/whatsapp-glyph';
import NewsletterForm from '@/components/site/newsletter-form';
import { CONTACT } from '@/lib/site/links.mjs';
import { whatsappHref } from '@/lib/site/whatsapp-link.mjs';

const QUICK_LINKS = [
  ['home', 'Home'],
  ['about', 'About us'],
  ['explore-our-app', 'Access Our App'],
  ['bulk-discounts', 'Bulk Discounts'],
  ['our-service-locations', 'Our Service Locations'],
  ['catalog', 'Catalog'],
  ['blog', 'Blog'],
  ['for-professionals', 'For Professionals'],
  ['our-process', 'Our Process'],
];

const POLICY_LINKS = [
  ['shipping-policy', 'Shipping Policy'],
  ['return-refund-policy', 'Returns/Refunds'],
  ['customer-feedback', 'Customer Feedback'],
  ['affiliate-program', 'Affiliate Program'],
  ['privacy-policy', 'Privacy Policy'],
  ['html-sitemap', 'HTML Sitemap'],
];

/** The prototype's footer. Server-rendered: every link is in the page source. */
export default function SiteFooter({ t, links, categories, contact = CONTACT, socials = [] }) {
  const whatsapp = whatsappHref(contact.whatsapp, t("Hi! I'd like to order."));
  return (
    <footer className="sfoot">
      <div className="wrap">
        <div className="fgrid">
          <div className="fbrand">
            <img className="logo" src="/site/logo-white.svg" alt={t('Peptidos Colombia')} />
            <p className="slogan">{t('Unlimited potential')}</p>
            <Link className="fapp" href={links['explore-our-app']} data-cta="footer-app">
              <span className="fqr"><img src="/site/app-qr.svg" alt="" /></span>
              <span>
                <b>{t('Get the PCR app')}</b>
                <small>{t('Earn points on every order and unlock extra discounts and free delivery. Free, no app store needed.')}</small>
              </span>
              <Ms name="arrow_forward" />
            </Link>
            <p>{t('Research-grade peptides in local stock in Colombia. Third-party tested, stored at 2–8 °C, delivered in 2–4 days.')}</p>
          </div>
          <div>
            <h4>{t('Quick Links')}</h4>
            {QUICK_LINKS.map(([key, label]) => <Link key={key} href={links[key]}>{t(label)}</Link>)}
          </div>
          <div>
            <h4>{t('Policies')}</h4>
            {POLICY_LINKS.map(([key, label]) => <Link key={key} href={links[key]}>{t(label)}</Link>)}
          </div>
          <div>
            <h4>{t('Shop By Categories')}</h4>
            <div>
              {categories.slice(0, 5).map((category) => (
                <Link key={category.href} href={category.href}>{t(category.name)}</Link>
              ))}
              <Link href={links.shop}>{t('View all')}</Link>
            </div>
          </div>
          <div>
            <h4>{t('Contact Us')}</h4>
            <a href={`mailto:${contact.email}`}><Ms name="mail" />{contact.email}</a>
            <a href={contact.phoneCrHref}><Ms name="call" />CR {contact.phoneCr}</a>
            <a href={contact.phoneUsHref}><Ms name="call" />US {contact.phoneUs}</a>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <span className="wai"><WhatsAppGlyph /></span>
              {t('Order on WhatsApp')}
            </a>
            <NewsletterForm
              labels={{
                title: t('Offers and new compounds by email'),
                placeholder: t('Your email'),
                button: t('Subscribe'),
                done: t("You're subscribed. Thank you!"),
                error: t('Please enter a valid email address.'),
              }}
            />
            <div className="socials">
              {socials.map(([name, href]) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer">{name}</a>
              ))}
            </div>
          </div>
        </div>
        <p className="legal">
          <b>{t('Research use only.')}</b>{' '}
          {t('All products are supplied for laboratory research. Not for human or veterinary use. Not approved for the diagnosis, treatment, cure or prevention of any condition. We do not provide dosing or medical advice.')}
        </p>
        <p className="legal">{t('© 2026 Peptidos Colombia · Colombia')}</p>
      </div>
    </footer>
  );
}
