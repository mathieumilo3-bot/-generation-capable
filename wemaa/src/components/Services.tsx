import { Link } from "react-router-dom";
import { servicesSection, services } from "../data/content";
import { images } from "../data/images";
import { Img } from "./Img";
import { Reveal } from "./Reveal";

export function Services() {
  return (
    <section id="expertises" className="bg-noir py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal as="div" className="max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
            <span className="h-px w-8 bg-or" />
            EXPERTISES
          </p>
          <h2 className="text-balance font-serif text-4xl leading-tight text-ivoire sm:text-5xl">
            {servicesSection.title}
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, i) => (
            <Reveal key={service.id} delay={i * 100}>
              <article className="group relative flex h-[420px] flex-col justify-end overflow-hidden rounded-2xl border border-or/15 transition-colors duration-500 hover:border-or/40">
                <Img
                  src={images[service.imageKey]}
                  alt={service.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/50 to-noir/10 transition-opacity duration-500 group-hover:from-noir/95" />

                <div className="relative z-10 flex flex-col gap-3 p-7 transition-transform duration-500 group-hover:-translate-y-1">
                  <h3 className="font-serif text-2xl text-ivoire">{service.title}</h3>
                  <p className="text-sm leading-relaxed text-ivoire/70">{service.description}</p>
                  <Link
                    to="/devis"
                    className="mt-2 inline-flex w-fit items-center gap-2 text-xs font-medium tracking-wide text-or opacity-0 transition-all duration-500 group-hover:opacity-100"
                  >
                    Découvrir
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
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
