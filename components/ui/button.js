import Link from 'next/link';

const VARIANTS = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary/90 hover:shadow-md',
  accent: 'bg-accent text-white shadow-sm hover:bg-accent/90 hover:shadow-md',
  outline: 'border border-primary/25 bg-white text-primary hover:border-primary hover:bg-primary hover:text-white',
};

const SIZES = {
  sm: 'min-h-10 px-4 py-2 text-sm',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-7 py-3 text-base',
};

/**
 * Renders a next/link for internal paths and a plain anchor for external ones.
 * External links (the catalog site, press, tel:, mailto:) must not go through
 * the client-side router.
 */
export default function Button({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg font-bold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  const isExternal = /^(https?:|tel:|mailto:)/.test(href || '');

  if (isExternal) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
