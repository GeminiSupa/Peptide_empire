import Link from 'next/link';

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  accent: 'bg-accent text-white hover:bg-accent/90',
  outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
};

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-base sm:text-lg',
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
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

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
