import Link from "next/link";
import { CASE_STUDY_PATH, COMMUNES, COMPANY, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { SERVICES } from "@/lib/demos/clos-et-cadre/services";
import { Container, Slot } from "./ui";

export function Footer() {
  return (
    <footer className="bg-[var(--cc-dark)] text-[var(--cc-on-dark)]">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="cc-serif text-[30px] leading-none">
              Clos <span className="text-[#c98a67]">&amp;</span> Cadre
            </p>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-[var(--cc-on-dark-muted)]">{COMPANY.legalLine}, dans l&apos;Ouest parisien.</p>
            <div className="mt-6 space-y-1 text-[15px]">
              <a href={COMPANY.phoneHref} className="block tabular-nums hover:text-white">
                {COMPANY.phoneDisplay}
              </a>
              <a href={`mailto:${COMPANY.email}`} className="block text-[var(--cc-on-dark-muted)] hover:text-white">
                {COMPANY.email}
              </a>
              <p className="pt-2 text-[var(--cc-on-dark-muted)]">{COMPANY.hours}</p>
            </div>
          </div>

          <div>
            <p className="cc-label text-[var(--cc-on-dark-muted)]">Expertises</p>
            <ul className="mt-4 space-y-2 text-[15px]">
              {SERVICES.map((service) => (
                <li key={service.id}>
                  <Link href={`${DEMO_BASE_PATH}/expertises#${service.id}`} className="hover:text-white">
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="cc-label text-[var(--cc-on-dark-muted)]">Secteur</p>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--cc-on-dark-muted)]">
              {COMMUNES.slice(0, 9)
                .map((commune) => commune.name)
                .join(" · ")}{" "}
              et communes voisines (78, 92).
            </p>
          </div>

          <div>
            <p className="cc-label text-[var(--cc-on-dark-muted)]">L&apos;entreprise</p>
            <ul className="mt-4 space-y-2 text-[15px]">
              <li>
                <Link href={`${DEMO_BASE_PATH}/realisations`} className="hover:text-white">
                  Réalisations
                </Link>
              </li>
              <li>
                <Link href={`${DEMO_BASE_PATH}/entreprise`} className="hover:text-white">
                  Garanties et assurances
                </Link>
              </li>
              <li>
                <Link href={`${DEMO_BASE_PATH}/projet`} className="hover:text-white">
                  Décrire votre projet
                </Link>
              </li>
            </ul>
            <div className="mt-6 space-y-2 text-[13px] text-[var(--cc-on-dark-muted)] [&_.cc-slot]:border-[#c98a67]/50 [&_.cc-slot]:text-[#d9a283]">
              <p>
                <Slot value={COMPANY.address} />
              </p>
              <p>
                <Slot value={COMPANY.siren} />
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-[13px] text-[var(--cc-on-dark-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Site de démonstration : Clos &amp; Cadre est une entreprise fictive. Aucune donnée saisie n&apos;est conservée.
          </p>
          <Link href={CASE_STUDY_PATH} className="hover:text-white">
            Concept stratégique et design — Génération Capable
          </Link>
        </div>
      </Container>
    </footer>
  );
}
