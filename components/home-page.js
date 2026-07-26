import Link from 'next/link';
import { Check, ExternalLink, Phone } from 'lucide-react';
import Container from '@/components/ui/container';
import Section, { SectionHeading } from '@/components/ui/section';
import Button from '@/components/ui/button';
import FeatureCard from '@/components/ui/feature-card';
import ProductCard from '@/components/product-card';
import FaqAccordion from '@/components/faq-accordion';
import { CATEGORIES, label } from '@/lib/nav';
import { CONTACT, PRESS, catalogUrl, localePath } from '@/lib/site';

/**
 * Home page composition. Section order mirrors the live site top to bottom.
 * `c` is the language-specific content module.
 */
export default function HomePage({ lang = 'en', c }) {
  const lp = (path) => localePath(path, lang);
  const allProducts = lp('/all-peptide-products-costa-rica/');

  return (
    <>
      {/* 1 — Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
              {c.hero.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-text-main sm:text-lg">
              {c.hero.intro}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
              {c.hero.body}
            </p>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {c.hero.chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm"
                >
                  <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-9">
              <Button href={allProducts} variant="accent" size="lg">
                {c.hero.cta}
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* 2 — Press band */}
      <div className="border-y border-slate-200 bg-white py-6">
        <Container className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-6">
          <p className="text-xs font-bold tracking-[0.2em] text-text-muted uppercase">
            {c.press.eyebrow}
          </p>
          <p className="text-sm font-semibold text-primary">{PRESS.outlet}</p>
          <p className="text-sm text-text-muted">{c.press.text}</p>
          <a
            href={PRESS.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            {c.press.cta}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </Container>
      </div>

      {/* 3 — We do things differently */}
      <Section className="bg-white">
        <SectionHeading title={c.differently.title} intro={c.differently.intro} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {c.differently.cards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </Section>

      {/* 4 — Shop by category chips */}
      <Section id="categories" className="bg-bg-main">
        <SectionHeading title={c.shopByCategory.title} />
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {CATEGORIES.map((cat) => (
            <li key={cat.slug}>
              <Link
                href={lp(cat.slug)}
                className="inline-flex rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-accent hover:text-accent"
              >
                {label(cat, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5 — Product grid */}
      <Section className="bg-white">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {c.products.map((p, i) => (
            <ProductCard key={`${p.name}-${i}`} product={p} lang={lang} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button href={allProducts} variant="outline">
            {c.whoThisIsFor.cta}
          </Button>
        </div>
      </Section>

      {/* 6 — What we offer */}
      <Section className="bg-bg-main">
        <SectionHeading title={c.whatWeOffer.title} intro={c.whatWeOffer.intro} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.whatWeOffer.cards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </Section>

      {/* 7 — Who this is for */}
      <Section className="bg-white">
        <SectionHeading title={c.whoThisIsFor.title} intro={c.whoThisIsFor.intro} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {c.whoThisIsFor.cards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button href={allProducts} variant="accent">
            {c.whoThisIsFor.cta}
          </Button>
        </div>
      </Section>

      {/* 8 — Customer transformation */}
      <Section className="bg-bg-main">
        <SectionHeading
          eyebrow={c.transformation.eyebrow}
          title={c.transformation.title}
          intro={c.transformation.body}
        />
        <div className="mx-auto mt-10 max-w-2xl">
          {/* Before/after imagery pending original-resolution assets. */}
          <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-text-muted">
            Before / after image
          </div>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {c.transformation.disclaimers.map((d) => (
              <li key={d} className="text-xs text-text-muted">
                • {d}
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center">
            <Button href={allProducts} variant="primary">
              {c.transformation.cta}
            </Button>
          </div>
        </div>
      </Section>

      {/* 9 — Popular products */}
      <Section className="bg-white">
        <SectionHeading title={c.popularProducts.title} />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {c.popularProducts.items.map((p, i) => (
            <ProductCard key={`${p.name}-${i}`} product={p} lang={lang} />
          ))}
        </div>
      </Section>

      {/* 11 — Bulk offer */}
      <Section className="bg-primary">
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
            {c.bulkOffer.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold !text-white sm:text-4xl">
            {c.bulkOffer.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80">
            {c.bulkOffer.body}
          </p>
          <div className="mt-8">
            <Button href={lp('/bulk-discounts/')} variant="accent" size="lg">
              {c.bulkProgram.title}
            </Button>
          </div>
        </div>
      </Section>

      {/* 12 — Lab tested + research grade */}
      <Section className="bg-white">
        <div className="grid gap-8 lg:grid-cols-2">
          {[c.labTested, c.researchGrade].map((block) => (
            <div
              key={block.title}
              className="flex flex-col rounded-xl border border-slate-100 bg-bg-main p-8"
            >
              <h2 className="text-2xl font-bold sm:text-3xl">{block.title}</h2>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-text-muted">
                {block.body}
              </p>
              <div className="mt-6">
                <Button href={allProducts} variant="outline" size="sm">
                  {block.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 13 — Trusted supplier */}
      <Section className="bg-bg-main">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{c.trustedSupplier.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            {c.trustedSupplier.body}
          </p>
          <div className="mt-8">
            <Button href={CONTACT.crPhoneHref} variant="accent" size="lg">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {c.trustedSupplier.cta}
            </Button>
          </div>
        </div>
      </Section>

      {/* 14 — Call to order featured cards */}
      <Section className="bg-white">
        <div className="grid gap-6 md:grid-cols-2">
          {c.callToOrder.cards.map((card) => (
            <div
              key={card.name}
              className="flex flex-col rounded-xl border border-slate-200 bg-bg-card p-7 shadow-sm"
            >
              <span className="inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                {c.callToOrder.badge}
              </span>
              <h3 className="mt-4 text-xl font-bold">{card.name}</h3>
              <p className="mt-2 text-3xl font-extrabold text-primary">{card.price}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {card.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href={CONTACT.crPhoneHref} variant="accent">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {c.callToOrder.cta}
                </Button>
                <Button href={lp(card.slug)} variant="outline">
                  {c.transformation.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 15 — Latest products */}
      <Section className="bg-bg-main">
        <SectionHeading title={c.latestProducts.title} />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {c.latestProducts.items.map((p, i) => (
            <ProductCard key={`${p.name}-${i}`} product={p} lang={lang} />
          ))}
        </div>
      </Section>

      {/* 16 — Why choose us */}
      <Section className="bg-white">
        <SectionHeading
          eyebrow={c.whyChooseUs.eyebrow}
          title={c.whyChooseUs.title}
          intro={c.whyChooseUs.body}
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.whyChooseUs.cards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </Section>

      {/* 17 — Testimonials */}
      <Section className="bg-bg-main">
        <SectionHeading
          eyebrow={c.testimonials.eyebrow}
          title={c.testimonials.title}
          intro={c.testimonials.body}
        />
        {/* Individual testimonial quotes pending from the client. */}
      </Section>

      {/* 18 — FAQ */}
      <Section className="bg-white">
        <SectionHeading eyebrow={c.faq.eyebrow} title={c.faq.title} intro={c.faq.intro} />
        <FaqAccordion items={c.faq.items} />
      </Section>

      {/* Bulk savings program */}
      <Section className="bg-bg-main">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{c.bulkProgram.title}</h2>
          <p className="mt-3 text-base text-text-muted">{c.bulkProgram.subtitle}</p>
          <p className="mt-3 text-xs text-text-muted">{c.bulkProgram.note}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href={CONTACT.crPhoneHref} variant="accent">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {c.bulkProgram.cta}
            </Button>
            <Button href={catalogUrl(lang)} variant="outline">
              {c.hero.cta}
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
