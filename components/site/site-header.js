'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Ms from '@/components/storefront/icon';
import WhatsAppGlyph from '@/components/storefront/whatsapp-glyph';
import { useSite } from '@/components/site/site-provider';
import { DealClock } from '@/components/site/deal-bits';
import { cartCount } from '@/lib/storefront/cart-math.mjs';

const ABOUT_LINKS = [
  ['our-process', 'Our Process', 'fact_check'],
  ['about', 'About us', 'info'],
  ['our-story', 'Our Story', 'history_edu'],
  ['explore-our-app', 'Explore Our App', 'smartphone'],
  ['bulk-discounts', 'Bulk Discounts', 'sell'],
  ['lab-tests-coa-results', 'COA Database', 'lab_profile'],
  ['affiliate-program', 'Affiliate Program', 'handshake'],
  ['faq-costa-rica', 'FAQ', 'help'],
  ['blog', 'Blog', 'article'],
];

const DRAWER_LINKS = [
  ['our-process', 'Our process', 'fact_check'],
  ['lab-tests-coa-results', 'COA database', 'lab_profile'],
  ['bulk-discounts', 'Bulk discounts', 'sell'],
  ['info-center', 'Info Center', 'school'],
  ['blog', 'Blog', 'article'],
  ['about', 'About us', 'info'],
  ['our-story', 'Our story', 'history_edu'],
  ['affiliate-program', 'Affiliate program', 'handshake'],
  ['faq-costa-rica', 'FAQ', 'help'],
  ['contact-costa-rica', 'Contact', 'mail'],
  ['explore-our-app', 'Our app', 'smartphone'],
];

/**
 * The announcement bar, sticky header, desktop menus, mobile deal bar and the
 * mobile drawer — the prototype's chrome, with every `#key` link resolved to
 * its real path by the server (`links`).
 */
export default function SiteHeader({
  links,
  products,
  popular,
  categories,
  deal,
  altHref,
  compoundCount,
  freeShippingLabel,
  banners = [],
}) {
  const {
    lang, t, currency, setCurrency, cart, whatsapp, contact,
    setSheetOpen, drawerOpen, setDrawerOpen, setSearchOpen,
  } = useSite();
  const [openMenu, setOpenMenu] = useState('');
  const [prefOpen, setPrefOpen] = useState(false);
  const navRef = useRef(null);
  const prefRef = useRef(null);
  const count = cartCount(cart);

  // A click anywhere outside a dropdown closes it, as in the design.
  useEffect(() => {
    const onClick = (event) => {
      if (!navRef.current?.contains(event.target)) setOpenMenu('');
      if (!prefRef.current?.contains(event.target)) setPrefOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const menu = (id, label, panelClass, children) => (
    <div className={`dd${openMenu === id ? ' open' : ''}`}>
      <button
        type="button"
        aria-expanded={openMenu === id}
        onClick={() => setOpenMenu(openMenu === id ? '' : id)}
      >
        {t(label)}
        <Ms name="expand_more" />
      </button>
      <div className={`ddp ${panelClass}`} onClick={() => setOpenMenu('')}>{children}</div>
    </div>
  );

  const closeDrawer = () => setDrawerOpen(false);
  const dealHref = links['deal-of-the-week'];

  return (
    <>
      <div className="announce">
        <div className="wrap">
          {deal ? (
            <Link href={dealHref} data-deal="">
              <Ms name="local_offer" />
              {t('Deal of the Week')}
            </Link>
          ) : null}
          {/* The banners switched on in the catalog admin take the place of
              the design's standing offers, as on the catalog. */}
          {banners.length ? banners.map((banner) => {
            const href = banner.href === 'whatsapp'
              ? whatsapp('')
              : /^\/catalog(\/|\?|$)/.test(banner.href) ? links.catalog : banner.href;
            const external = /^https?:\/\//.test(href) || banner.href === 'whatsapp';
            return href ? (
              <a key={banner.id} href={href} data-banner="" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <Ms name="campaign" />{banner.text}
              </a>
            ) : (
              <span key={banner.id} data-banner=""><Ms name="campaign" />{banner.text}</span>
            );
          }) : (
            <>
              <span><Ms name="redeem" />{t('Free BAC Water with every order')}</span>
              <span><Ms name="sell" />{t('15% off 5+ · 20% off 10+')}</span>
              <span><Ms name="local_shipping" />{t(`Free delivery over ${freeShippingLabel}`)}</span>
            </>
          )}
          <Link href={links['explore-our-app']} data-cta="announce-app">
            <Ms name="smartphone" />
            {t('Earn points & extra discounts in our app')}
          </Link>
        </div>
      </div>

      <header className="top">
        <div className="wrap">
          <button
            type="button"
            className="icbtn menub"
            aria-label={t('Menu')}
            onClick={() => setDrawerOpen(true)}
          >
            <Ms name="menu" />
          </button>
          <Link href={links.home} aria-label={t('Home')} className="lg">
            <img className="logo" src="/site/logo.webp" alt="Peptides Costa Rica" />
          </Link>

          <nav className="mainnav" aria-label="Main" ref={navRef}>
            <Link href={links.catalog} className="navcat" data-nav="catalog" style={{ marginLeft: 0, marginRight: 6 }}>
              <Ms name="grid_view" />
              {t('Catalog')}
            </Link>
            {deal ? (
              <Link href={dealHref} data-deal="" className="navdeal" data-cta="nav-deal">
                <Ms name="sell" />
                {t('Deal of the Week')}
              </Link>
            ) : null}
            {menu('about', 'About', 'sm', ABOUT_LINKS.map(([key, label, icon]) => (
              <Link key={key} href={links[key]}><span className="ms">{icon}</span>{t(label)}</Link>
            )))}
            {menu('products', 'Shop by Product', 'mega', (
              <>
                {products.map((product) => (
                  <Link key={product.href} href={product.href}>{product.name}</Link>
                ))}
                <Link className="all" href={links.catalog}>{t('View all in the catalog →')}</Link>
              </>
            ))}
            {menu('categories', 'Shop by Category', 'cats', (
              <>
                {categories.map((category) => (
                  <Link key={category.href} href={category.href}>
                    <span className="ms">{category.icon}</span>
                    {t(category.name)}
                  </Link>
                ))}
                <Link className="all" href={links.shop}>{t('All categories →')}</Link>
              </>
            ))}
            <Link href={links['info-center']} className="navinfo">{t('Info Center')}</Link>
            <Link href={links['explore-our-app']} className="navapp" data-cta="nav-app">
              <Ms name="smartphone" />
              {t('App')}
            </Link>
            <Link href={links['for-professionals']}>{t('For Professionals')}</Link>
          </nav>

          <span className="sp" />
          <div className="pref" ref={prefRef}>
            <button
              type="button"
              className="prefbtn"
              aria-haspopup="true"
              aria-expanded={prefOpen}
              aria-label={t('Language and currency')}
              onClick={() => setPrefOpen(!prefOpen)}
            >
              <span className="ms">language</span>
              {lang.toUpperCase()} · {currency === 'USD' ? 'US$' : '₡'}
            </button>
            <div className="prefmenu" hidden={!prefOpen}>
              <small>Language · Idioma</small>
              <div className="seg">
                {lang === 'en'
                  ? <button type="button" aria-pressed="true">English</button>
                  : <a href={altHref} role="button" aria-pressed="false">English</a>}
                {lang === 'es'
                  ? <button type="button" aria-pressed="true">Español</button>
                  : <a href={altHref} role="button" aria-pressed="false">Español</a>}
              </div>
              <small>Currency · Moneda</small>
              <div className="seg">
                <button type="button" aria-pressed={currency === 'CRC'} onClick={() => setCurrency('CRC')}>₡ Colones</button>
                <button type="button" aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>US$ Dollars</button>
              </div>
            </div>
          </div>
          <Link
            className="icbtn appbtn"
            href={links['explore-our-app']}
            data-cta="header-app"
            aria-label={t('Get the app: points and extra discounts')}
            title={t('Get the app: points & extra discounts')}
          >
            <Ms name="smartphone" />
            <span className="appbdg">%</span>
          </Link>
          <button type="button" className="icbtn" aria-label={t('Search')} onClick={() => setSearchOpen(true)}>
            <Ms name="search" />
          </button>
          <button type="button" className="icbtn" aria-label={t('View my order')} onClick={() => setSheetOpen(true)}>
            <Ms name="shopping_bag" />
            <span className={`cnt${count ? '' : ' zero'}`}>{count}</span>
          </button>
          <a
            className="btn sm wab"
            data-cta="nav"
            href={whatsapp(t('Hi! I have a question about an order.'))}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppGlyph />
            <span>WhatsApp</span>
          </a>
        </div>
        {deal ? (
          <Link className="mdeal" href={dealHref} data-deal="" data-cta="mobile-deal-bar">
            <span className="mdi"><span className="ms">sell</span></span>
            <span className="mdt"><b>{deal.name}</b><small>{deal.headline}</small></span>
            <span className="mdc"><small>{t('Ends in')}</small><b className="num"><DealClock endsAt={deal.endsAt} /></b></span>
            <span className="ms mda">chevron_right</span>
          </Link>
        ) : null}
      </header>

      <div className={`scrim${drawerOpen ? ' open' : ''}`} onClick={closeDrawer} />
      <aside className={`drawer${drawerOpen ? ' open' : ''}`} aria-label={t('Menu')} aria-hidden={!drawerOpen}>
        <div className="dh">
          <img className="logo" src="/site/logo.webp" alt="" />
          <button type="button" className="icbtn" aria-label={t('Close menu')} onClick={closeDrawer}>
            <span className="ms">close</span>
          </button>
        </div>
        <button
          type="button"
          className="search dsearch"
          onClick={() => { closeDrawer(); setSearchOpen(true); }}
          style={{ width: '100%', textAlign: 'left' }}
        >
          <span className="ms">search</span>
          <span className="muted">{t(`Search ${compoundCount} compounds`)}</span>
        </button>
        <div onClick={(event) => { if (event.target.closest('a')) closeDrawer(); }}>
          <div className="dquick">
            <Link href={links.catalog} className="dq pri"><span className="ms">grid_view</span>{t('Catalog')}</Link>
            <a className="dq" href={whatsapp(t('Hi! I have a question.'))} target="_blank" rel="noopener noreferrer">
              <span className="wai"><WhatsAppGlyph /></span>WhatsApp
            </a>
            <button type="button" className="dq" onClick={() => { closeDrawer(); setSheetOpen(true); }}>
              <span className="ms">shopping_bag</span>{t('My order')}
            </button>
          </div>
          {deal ? (
            <Link className="ddeal" href={dealHref} data-deal="" data-cta="drawer-deal">
              <span className="ms">sell</span>
              <span><b>{t('Deal of the Week')}</b><small>{deal.name} · {deal.headline}</small></span>
              <span className="ms">chevron_right</span>
            </Link>
          ) : null}
          <div>
            <h4 className="dl2">{t('Popular')}</h4>
            <div className="dpop">
              {popular.map((product) => (
                <Link key={product.href} href={product.href}>
                  <img src={product.image} alt="" />
                  {product.name}
                </Link>
              ))}
            </div>
          </div>
          <details className="dacc">
            <summary><span className="ms">category</span>{t('Shop by category')}<span className="ms ch">expand_more</span></summary>
            <div className="dcats one">
              {categories.map((category) => (
                <Link key={category.href} href={category.href}>
                  <span className="ms">{category.icon}</span>
                  {t(category.name)}
                </Link>
              ))}
            </div>
          </details>
          <details className="dacc">
            <summary><span className="ms">menu_book</span>{t('Learn & about')}<span className="ms ch">expand_more</span></summary>
            <div className="dlinks one">
              {DRAWER_LINKS.map(([key, label, icon]) => (
                <Link key={key} href={links[key]}><span className="ms">{icon}</span>{t(label)}</Link>
              ))}
            </div>
          </details>
          <Link className="dpro" href={links['for-professionals']}>
            <span className="ms">business_center</span>
            <span><b>{t('For clinics & labs')}</b><small>{t('Professional pricing and custom sizes')}</small></span>
            <span className="ms">arrow_forward</span>
          </Link>
          <div className="dcontact">
            <a href={contact.phoneCrHref}><span className="ms">call</span>{contact.phoneCr}</a>
            <a href={contact.phoneUsHref}><span className="ms">call</span>{contact.phoneUs}</a>
          </div>
        </div>
      </aside>
    </>
  );
}
