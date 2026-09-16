import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Hero } from "../components/Hero";
import { Services } from "../components/Services";
import { About } from "../components/About";
import { Stats } from "../components/Stats";
import { Portfolio } from "../components/Portfolio";
import { Testimonials } from "../components/Testimonials";
import { ProcessSteps } from "../components/ProcessSteps";
import { CtaFinal } from "../components/CtaFinal";
import { ctaFinal } from "../data/content";
import { images } from "../data/images";

export function Home() {
  const location = useLocation();

  // Permet aux liens du type "/#expertises" venant d'une autre page
  // d'atterrir sur la bonne section une fois la page d'accueil chargée.
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  return (
    <>
      <Hero />
      <Services />
      <About />
      <Stats />
      <Portfolio />
      <Testimonials />
      <ProcessSteps />
      <CtaFinal
        title={ctaFinal.title}
        subtitle={ctaFinal.subtitle}
        cta={ctaFinal.cta}
        image={images.ctaFinal}
      />
    </>
  );
}
