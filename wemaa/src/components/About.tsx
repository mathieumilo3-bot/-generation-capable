import { about } from "../data/content";
import { images } from "../data/images";
import { OutlineButton } from "./Button";
import { Img } from "./Img";
import { Reveal } from "./Reveal";

export function About() {
  return (
    <section id="apropos" className="relative overflow-hidden bg-noir-soft py-28 lg:py-36">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-or/5 blur-3xl" />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <Reveal as="div" className="order-2 lg:order-1">
          <p className="mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
            <span className="h-px w-8 bg-or" />
            À PROPOS
          </p>
          <h2 className="whitespace-pre-line font-serif text-4xl leading-tight text-ivoire sm:text-5xl">
            {about.title}
          </h2>
          <div className="mt-7 space-y-5">
            {about.paragraphs.map((p) => (
              <p key={p} className="max-w-lg text-base leading-relaxed text-ivoire/70">
                {p}
              </p>
            ))}
          </div>
          <div className="mt-10">
            <OutlineButton href="/#apropos">
              {about.cta}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </OutlineButton>
          </div>
        </Reveal>

        <Reveal as="div" delay={150} className="relative order-1 lg:order-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-or/20">
            <Img
              src={images.aboutPortrait}
              alt="Membre de l'équipe Wemaa Services préparant la mise en place d'un événement"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-noir/40 via-transparent to-transparent" />
          </div>
          <div className="absolute -bottom-6 -right-6 hidden h-32 w-32 rounded-2xl border border-or/30 sm:block" />
        </Reveal>
      </div>
    </section>
  );
}
