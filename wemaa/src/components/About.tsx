import { team } from "../data/content";
import { images } from "../data/images";
import { OutlineButton } from "./Button";
import { Img } from "./Img";
import { Reveal } from "./Reveal";

export function About() {
  return (
    <section id="apropos" className="relative overflow-hidden bg-noir">
      <div className="absolute inset-0">
        <Img
          src={images.teamPhoto}
          alt="L'équipe Wemaa Services en tenue, prête à accueillir les invités"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-noir via-noir/75 to-noir/30" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 lg:px-10 lg:py-36">
        <Reveal className="max-w-lg">
          <p className="mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
            <span className="h-px w-8 bg-or" />
            {team.eyebrow.toUpperCase()}
          </p>
          <h2 className="whitespace-pre-line text-balance font-serif text-4xl leading-tight text-ivoire sm:text-5xl">
            {team.title}
          </h2>
          <div className="mt-6 space-y-4">
            {team.paragraphs.map((p) => (
              <p key={p} className="text-base leading-relaxed text-ivoire/75">
                {p}
              </p>
            ))}
          </div>
          <div className="mt-9">
            <OutlineButton href="/devis">
              {team.cta}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </OutlineButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
