import { hero } from "../data/content";
import { images } from "../data/images";
import { GoldButton } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Img } from "./Img";

export function Hero() {
  return (
    <section id="accueil" className="relative bg-noir pt-24 lg:pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl border border-or/15">
          <div className="absolute inset-0">
            <Img
              src={images.heroBackground}
              alt="Réception événementielle haut de gamme sous une tente illuminée"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/60 to-noir/20" />
          </div>

          <div className="relative z-10 flex min-h-[560px] flex-col justify-end px-6 py-10 sm:px-10 sm:py-14 lg:min-h-[640px] lg:px-14">
            <div className="max-w-2xl animate-[fade-up_1s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
              <p className="mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
                <span className="h-px w-8 bg-or" />
                {hero.label.toUpperCase()}
              </p>

              <h1 className="text-balance font-serif text-4xl leading-[1.1] text-ivoire sm:text-5xl lg:text-6xl">
                {hero.title}
              </h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-ivoire/75">{hero.subtitle}</p>

              <div className="mt-8">
                <GoldButton href="/devis">
                  {hero.cta}
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </GoldButton>
              </div>
            </div>
          </div>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 pb-16 sm:grid-cols-4 lg:pb-20">
          {hero.reassurance.map((item) => (
            <li key={item.label} className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-or/30 text-or">
                <Icon name={item.icon as IconName} className="h-4 w-4" />
              </span>
              <span className="text-sm text-ivoire/75">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
