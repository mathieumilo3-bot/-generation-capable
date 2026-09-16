import { hero } from "../data/content";
import { images } from "../data/images";
import { GoldButton } from "./Button";
import { Img } from "./Img";

export function Hero() {
  return (
    <section id="accueil" className="relative flex min-h-screen items-center overflow-hidden bg-noir">
      <div className="absolute inset-0">
        <Img
          src={images.heroBackground}
          alt="Réception événementielle haut de gamme, tables dressées à la lueur des bougies"
          className="h-full w-full scale-105 animate-[fade-in_1.6s_ease] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-noir/80 via-noir/55 to-noir" />
        <div className="absolute inset-0 bg-gradient-to-r from-noir/70 via-transparent to-noir/40" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-28 pb-16 lg:px-10">
        <div className="max-w-2xl animate-[fade-up_1s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
          <p className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
            <span className="h-px w-8 bg-or" />
            {hero.label.toUpperCase()}
          </p>

          <h1 className="text-balance font-serif text-5xl leading-[1.08] text-ivoire sm:text-6xl lg:text-[4.2rem]">
            {hero.titleLine1} <span className="text-or italic">{hero.titleHighlight}</span>
          </h1>

          <p className="mt-7 max-w-lg text-base leading-relaxed text-ivoire/75 sm:text-lg">
            {hero.subtitle}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <GoldButton href="/devis">
              {hero.cta}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </GoldButton>
          </div>

          <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-ivoire/10 pt-8 sm:grid-cols-3">
            {hero.reassurance.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-ivoire/70">
                <span className="h-1 w-1 shrink-0 rounded-full bg-or" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-ivoire/50 sm:flex">
        <span className="text-[10px] tracking-[0.3em]">DÉCOUVRIR</span>
        <span className="h-10 w-px animate-pulse bg-gradient-to-b from-or to-transparent" />
      </div>
    </section>
  );
}
