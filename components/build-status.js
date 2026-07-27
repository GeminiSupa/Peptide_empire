import Container from '@/components/ui/container';

/**
 * PLACEHOLDER BODY — deliberately obvious.
 *
 * The header and footer above/below are the real rebuilt chrome. The page body
 * itself has not been built yet (build order step 3). This block exists so that
 * a preview is never mistaken for a finished page.
 */
export default function BuildStatus({ lang = 'es', pageName = 'Home' }) {
  const copy =
    lang === 'es'
      ? {
          tag: 'CONTENIDO PENDIENTE',
          title: 'El encabezado y el pie de página ya están construidos',
          body: 'El cuerpo de esta página todavía no se ha construido. Lo que ves arriba y abajo es el menú y el pie de página reales, con los textos tomados del sitio en vivo en español e inglés.',
        }
      : {
          tag: 'PLACEHOLDER CONTENT',
          title: 'Header and footer are built',
          body: 'The body of this page has not been built yet. The header above and footer below are the real rebuilt chrome, with wording harvested from the live site in both languages.',
        };

  return (
    <main className="flex-1 py-20">
      <Container>
        <div className="mx-auto max-w-2xl rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-8 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">{copy.tag}</p>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{copy.title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-text-muted">{copy.body}</p>
          <p className="mt-6 text-xs text-text-muted">
            {pageName} · lang={lang}
          </p>
        </div>
      </Container>
    </main>
  );
}
