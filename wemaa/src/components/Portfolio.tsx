import { useState } from "react";
import { portfolioSection } from "../data/content";
import { images } from "../data/images";
import { OutlineButton } from "./Button";
import { Img } from "./Img";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";

const preview = images.portfolio.slice(0, 4);

export function Portfolio() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="realisations" className="bg-ivoire py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-4 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.35em] text-or-fonce">
            <span className="h-px w-8 bg-or-fonce" />
            {portfolioSection.eyebrow.toUpperCase()}
            <span className="h-px w-8 bg-or-fonce" />
          </p>
          <h2 className="text-balance font-serif text-4xl leading-tight text-charbon sm:text-5xl">
            {portfolioSection.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-charbon-soft">
            {portfolioSection.subtitle}
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {preview.map((photo, i) => (
            <Reveal key={photo.id} delay={i * 100}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-xl ring-1 ring-charbon/10 transition-all duration-500 hover:ring-or/40"
              >
                <Img
                  src={photo.src}
                  alt={photo.alt}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-noir/0 transition-colors duration-500 group-hover:bg-noir/30" />
                <span className="absolute bottom-4 left-4 text-xs tracking-[0.2em] text-ivoire opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  {photo.category.toUpperCase()}
                </span>
              </button>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 flex justify-center">
          <OutlineButton href="/realisations" tone="onLight">
            {portfolioSection.cta}
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </OutlineButton>
        </Reveal>
      </div>

      {openIndex !== null && (
        <Lightbox
          images={preview}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </section>
  );
}
