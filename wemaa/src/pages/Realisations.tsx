import { useMemo, useState } from "react";
import { images } from "../data/images";
import { Img } from "../components/Img";
import { Lightbox } from "../components/Lightbox";
import { Reveal } from "../components/Reveal";
import { GoldButton } from "../components/Button";

const categories = ["Tout", ...Array.from(new Set(images.portfolio.map((p) => p.category)))];

export function Realisations() {
  const [filter, setFilter] = useState("Tout");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = useMemo(
    () => (filter === "Tout" ? images.portfolio : images.portfolio.filter((p) => p.category === filter)),
    [filter],
  );

  return (
    <div className="bg-ivoire pt-40 pb-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-4 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.35em] text-or-fonce">
            <span className="h-px w-8 bg-or-fonce" />
            NOS RÉALISATIONS
            <span className="h-px w-8 bg-or-fonce" />
          </p>
          <h1 className="text-balance font-serif text-4xl leading-tight text-charbon sm:text-5xl">
            Chaque événement est une histoire unique.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-charbon-soft">
            Un aperçu de nos réalisations — mariages, réceptions, événements professionnels et
            décorations sur mesure imaginés par notre équipe.
          </p>
        </Reveal>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`rounded-full border px-5 py-2 text-xs tracking-wide transition-colors duration-300 ${
                filter === cat
                  ? "border-or bg-or text-noir"
                  : "border-charbon/20 text-charbon-soft hover:border-or/50 hover:text-or-fonce"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5">
          {filtered.map((photo, i) => (
            <Reveal key={photo.id} delay={(i % 3) * 80}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl ring-1 ring-charbon/10 transition-all duration-500 hover:ring-or/40"
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

        <Reveal className="mt-20 flex flex-col items-center gap-6 border-t border-charbon/10 pt-16 text-center">
          <h2 className="text-balance font-serif text-3xl text-charbon">
            Votre événement pourrait être le prochain.
          </h2>
          <GoldButton href="/devis">
            Demander un devis
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </GoldButton>
        </Reveal>
      </div>

      {openIndex !== null && (
        <Lightbox
          images={filtered}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </div>
  );
}
