import { processSection } from "../data/content";
import { Reveal } from "./Reveal";

export function ProcessSteps() {
  return (
    <section className="bg-creme py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="text-center">
          <h2 className="text-balance font-serif text-3xl text-charbon sm:text-4xl">{processSection.title}</h2>
        </Reveal>

        <div className="relative mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {processSection.steps.map((step, i) => (
            <Reveal key={step.number} delay={i * 100} className="relative flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-or bg-carte font-serif text-xl text-or-fonce">
                {step.number}
              </span>
              <h3 className="mt-5 text-base font-medium text-charbon">{step.title}</h3>
              <p className="mt-1.5 text-sm text-charbon-soft">{step.description}</p>

              {i < processSection.steps.length - 1 && (
                <span className="mt-5 hidden text-or-fonce/50 lg:absolute lg:right-[-1.6rem] lg:top-7 lg:mt-0 lg:block">
                  →
                </span>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
