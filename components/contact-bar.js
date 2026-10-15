import { Mail, Phone } from 'lucide-react';
import { contactBar } from '@/content/global';
import { label } from '@/lib/i18n';
import WhatsAppIcon from '@/components/whatsapp-icon';

/**
 * The floating contact bar.
 *
 * On the live site this is `position: fixed` and pinned to the bottom of the
 * VIEWPORT above everything else (z-index 9999), so it follows the reader down
 * the page. The clone had these three buttons stitched into the document
 * instead, which is why they turned up mid-page between sections and scrolled
 * away with the content.
 *
 * The tray stays above the page content; all contact actions use the shared
 * orange treatment.
 */
const STYLE = {
  whatsapp: { radius: '16px', Icon: WhatsAppIcon },
  phone: { radius: '6px', Icon: Phone },
  email: { radius: '6px', Icon: Mail },
};

export default function ContactBar({ lang }) {
  if (!contactBar?.length) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] bg-[#E9EEF3] px-3.5 pt-3 pb-4 shadow-[0_-2px_9px_rgba(0,0,0,0.2)] print:hidden"
      // The bar overlays the page, so the footer needs room to clear it. That
      // padding is on <body> in globals.css rather than here, where it would
      // scroll with the content it is meant to sit above.
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {contactBar.map((item) => {
          const { radius, Icon } = STYLE[item.kind] ?? STYLE.phone;
          return (
            <a
              className="contact-cta inline-flex min-h-12 items-center gap-2 rounded-md px-5 py-3 text-sm font-bold"
              href={item.href}
              key={item.href}
              rel={item.kind === 'whatsapp' ? 'noopener noreferrer' : undefined}
              style={{ borderRadius: radius }}
              target={item.kind === 'whatsapp' ? '_blank' : undefined}
            >
              {item.kind === 'whatsapp'
                ? <span className="contact-cta-icon"><Icon className="h-4 w-4" /></span>
                : <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
              {label(item, lang)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
