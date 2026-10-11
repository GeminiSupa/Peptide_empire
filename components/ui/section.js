import Container from '@/components/ui/container';

export function SectionHeading({ eyebrow, title, intro, align = 'center' }) {
  const alignment = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-3xl ${alignment}`}>
      {eyebrow && (
        <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className={`text-3xl font-extrabold tracking-tight sm:text-[2.5rem] ${eyebrow ? 'mt-3' : ''}`}>
          {title}
        </h2>
      )}
      {intro && (
        <p className="mt-4 text-base leading-7 text-text-muted">{intro}</p>
      )}
    </div>
  );
}

export default function Section({
  id,
  className = '',
  containerClassName = '',
  children,
}) {
  return (
    <section id={id} className={`py-12 sm:py-16 lg:py-20 ${className}`}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
