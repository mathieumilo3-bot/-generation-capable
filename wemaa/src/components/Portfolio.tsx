import { useState } from "react";
import { portfolioSection } from "../data/content";
import { images } from "../data/images";
import { GoldButton } from "./Button";
import { Img } from "./Img";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";

const preview = images.portfolio.slice(0, 6);

export function Portfolio() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="realisations" className="bg-noir py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
              <span className="h-px w-8 bg-or" />
              RÉALISATIONS
            </p>
            <h2 className="text-balance font-serif text-4xl leading-tight text-ivoire sm:text-5xl">
              {portfolioSection.title}
            </h2>
          </div>
          <GoldButton href="/realisations" className="shrink-0">
            {portfolioSection.cta}
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </GoldButton>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 lg:gap-5">
          {preview.map((photo, i) => (
            <Reveal
              key={photo.id}
              delay={(i % 3) * 100}
              className={i === 0 ? "col-span-2 lg:col-span-1 lg:row-span-2" : ""}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className={`group relative block w-full overflow-hidden rounded-xl border border-or/10 transition-colors duration-500 hover:border-or/40 ${
                  i === 0 ? "aspect-[4/5] lg:h-full" : "aspect-[4/3]"
                }`}
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
