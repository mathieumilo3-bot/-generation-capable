"use client";

import { useState, type FormEvent } from "react";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";

const CHECKS = [
  ["01", "ATTIRER", "D'où viennent vos visiteurs et est-ce que le message qui les amène correspond à ce qu'ils découvrent ?"],
  ["02", "COMPRENDRE", "Votre offre, votre cible et votre valeur sont-elles comprises avant que le visiteur décroche ?"],
  ["03", "CONVAINCRE", "Les preuves, réponses et éléments de confiance arrivent-ils au moment où le prospect hésite ?"],
  ["04", "CONVERTIR", "Le prochain pas est-il évident et la demande est-elle réellement exploitable par votre équipe ?"],
];

export function InstantCheck() {
  const [url, setUrl] = useState("");
  const [started, setStarted] = useState(false);

  function start(event: FormEvent) {
    event.preventDefault();
    if (url.trim().length < 4) return;
    setStarted(true);
    track("instant_check_started", { source: "homepage" });
  }

  return (
    <Section id="analyse" tone="raised" className="py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">
            Le diagnostic
          </p>
          <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Voyez où votre entreprise
            <br />
            <span className="text-[var(--color-muted)]">peut perdre des opportunités.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
            Donnez-nous votre site. Nous ne vous afficherons pas un faux score
            généré pour faire joli : nous regardons ce qui se passe réellement
            entre l&apos;arrivée d&apos;un prospect et sa prise de contact.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
                Capable Audit
              </p>
              <p className="mt-1 font-display text-sm font-medium">Diagnostic commercial de votre présence</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Humain · personnalisé
            </span>
          </div>

          <div className="p-5 sm:p-8">
            {!started ? (
              <form onSubmit={start} className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="instant-check-url" className="sr-only">
                  Adresse de votre site
                </label>
                <input
                  id="instant-check-url"
                  name="site"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  maxLength={300}
                  placeholder="https://votre-entreprise.fr"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full flex-1 rounded-xl border border-[var(--color-border-strong)] bg-transparent px-5 py-4 text-base text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
                />
                <button
                  type="submit"
                  disabled={url.trim().length < 4}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-text)] px-7 py-4 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Voir ce que nous analysons →
                </button>
              </form>
            ) : (
              <div>
                <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-5 py-4">
                  <p className="text-sm">
                    <span className="font-semibold">Votre site est le point de départ.</span>{" "}
                    Voici les quatre zones que nous vérifions avant de recommander quoi que ce soit.
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {CHECKS.map(([number, title, body]) => (
                    <div
                      key={number}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-display text-xs text-[var(--color-accent)]">{number}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.2em]">{title}</span>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    href={`/audit?site=${encodeURIComponent(url.trim())}`}
                    variant="primary"
                    trackEvent="cta_clicked"
                    trackPayload={{ location: "instant_check_result" }}
                  >
                    Recevoir mon diagnostic →
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStarted(false)}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border-strong)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
                  >
                    Recommencer
                  </button>
                  <span className="text-xs text-[var(--color-muted)]">
                    Votre adresse est déjà préremplie · Quelques minutes · Sans engagement
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
