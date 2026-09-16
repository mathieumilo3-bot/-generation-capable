import { Link } from "react-router-dom";
import { servicesSection, services } from "../data/content";
import { images } from "../data/images";
import { Icon } from "./Icon";
import { Img } from "./Img";
import { Reveal } from "./Reveal";

export function Services() {
  return (
    <section id="expertises" className="bg-creme py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-4 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.35em] text-or-fonce">
            <span className="h-px w-8 bg-or-fonce" />
            {servicesSection.eyebrow.toUpperCase()}
            <span className="h-px w-8 bg-or-fonce" />
          </p>
          <h2 className="text-balance font-serif text-4xl leading-tight text-charbon sm:text-5xl">
            {servicesSection.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-charbon-soft">
            {servicesSection.subtitle}
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, i) => (
            <Reveal key={service.id} delay={i * 100}>
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-carte shadow-[0_18px_40px_-24px_rgba(32,28,21,0.35)] ring-1 ring-charbon/5 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-20px_rgba(32,28,21,0.4)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Img
                    src={images[service.imageKey]}
                    alt={service.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-3 p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-or/40 text-or-fonce">
                    <Icon name={service.icon} className="h-4 w-4" />
                  </span>
                  <h3 className="font-serif text-xl text-charbon">{service.title}</h3>
                  <p className="text-sm leading-relaxed text-charbon-soft">{service.description}</p>
                  <Link
                    to="/devis"
                    className="mt-auto inline-flex w-fit items-center gap-2 pt-2 text-xs font-medium tracking-wide text-or-fonce transition-all duration-300 hover:gap-3 hover:text-noir"
                  >
                    Découvrir
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
