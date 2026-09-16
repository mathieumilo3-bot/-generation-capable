import { GoldButton } from "./Button";
import { Img } from "./Img";
import { Reveal } from "./Reveal";

type CtaFinalProps = {
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  id?: string;
  compact?: boolean;
};

export function CtaFinal({ title, subtitle, cta, image, id, compact = false }: CtaFinalProps) {
  return (
    <section id={id} className={`relative overflow-hidden ${compact ? "py-20 lg:py-24" : "py-36 lg:py-44"}`}>
      <div className="absolute inset-0">
        <Img src={image} alt="Ambiance lumineuse d'un événement en soirée" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-noir/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/40 to-noir/70" />
      </div>

      <Reveal as="div" className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <h2 className="text-balance font-serif text-3xl leading-tight text-ivoire sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-ivoire/75 sm:text-lg">{subtitle}</p>
        <div className="mt-10">
          <GoldButton href="/devis">
            {cta}
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </GoldButton>
        </div>
      </Reveal>
    </section>
  );
}
