import { ctaFinal } from "../data/content";
import { images } from "../data/images";
import { GoldButton } from "./Button";
import { Img } from "./Img";
import { Reveal } from "./Reveal";

export function CtaFinal() {
  return (
    <section id="contact" className="relative overflow-hidden py-36 lg:py-44">
      <div className="absolute inset-0">
        <Img
          src={images.ctaFinal}
          alt="Ambiance lumineuse d'un événement en soirée"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-noir/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/40 to-noir/70" />
      </div>

      <Reveal as="div" className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <h2 className="text-balance font-serif text-4xl leading-tight text-ivoire sm:text-5xl">{ctaFinal.title}</h2>
        <p className="mt-5 text-base leading-relaxed text-ivoire/75 sm:text-lg">{ctaFinal.subtitle}</p>
        <div className="mt-10">
          <GoldButton href="/devis">
            {ctaFinal.cta}
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </GoldButton>
        </div>
      </Reveal>
    </section>
  );
}
