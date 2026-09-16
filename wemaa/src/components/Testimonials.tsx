import { testimonials, testimonialsSection } from "../data/content";
import { Reveal } from "./Reveal";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1 text-or" aria-label={`${rating} sur 5 étoiles`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5" fill={i < rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1">
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="bg-noir-soft py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-4 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
            <span className="h-px w-8 bg-or" />
            {testimonialsSection.eyebrow.toUpperCase()}
            <span className="h-px w-8 bg-or" />
          </p>
          <h2 className="text-balance font-serif text-4xl leading-tight text-ivoire sm:text-5xl">
            {testimonialsSection.title}
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 100}>
              <figure className="flex h-full flex-col justify-between rounded-2xl border border-or/15 bg-noir p-8 transition-colors duration-500 hover:border-or/35">
                <div>
                  <Stars rating={t.rating} />
                  <blockquote className="mt-5 text-[0.95rem] leading-relaxed text-ivoire/80">
                    « {t.quote} »
                  </blockquote>
                </div>
                <figcaption className="mt-7 flex items-center gap-3 border-t border-ivoire/10 pt-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-or/30 font-serif text-sm text-or">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ivoire">{t.name}</p>
                    <p className="text-xs text-ivoire/50">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-xs italic text-ivoire/35">{testimonialsSection.disclaimer}</p>
      </div>
    </section>
  );
}
