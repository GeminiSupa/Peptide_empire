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
        <h2 className={`text-3xl font-bold sm:text-4xl ${eyebrow ? 'mt-3' : ''}`}>
          {title}
        </h2>
      )}
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-text-muted">{intro}</p>
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
    <section id={id} className={`py-14 sm:py-20 ${className}`}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
