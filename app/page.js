export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
      <p className="text-sm font-semibold tracking-widest text-accent uppercase">
        Peptides Costa Rica
      </p>
      <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">
        Site rebuild in progress
      </h1>
      <p className="mt-6 text-lg text-text-muted">
        This is the Next.js rebuild of peptidescostarica.net. The live
        WordPress site is unaffected and remains the site of record until
        cutover.
      </p>
      <p className="mt-4 text-sm text-text-muted">
        This deployment is blocked from search engines until launch.
      </p>
    </main>
  );
}
