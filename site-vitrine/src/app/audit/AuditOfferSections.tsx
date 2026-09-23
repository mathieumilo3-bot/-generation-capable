export function AuditOfferSections() {
  return (
    <div className="mx-auto mt-20 max-w-6xl sm:mt-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Ce que GC construit
        </p>
        <h2 className="font-display mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-5xl">
          Un site d’artisan qui travaille vraiment pour votre entreprise.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)] sm:text-base">
          Le diagnostic vous montre où agir. GC peut ensuite construire le site, la visibilité locale et le parcours qui transforme une recherche en demande de devis.
        </p>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <section className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--color-accent)]/8 blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Vous n’avez pas encore de site
            </p>
            <h3 className="font-display mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">
              On construit la base complète.
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)] sm:text-[15px]">
              Pas un site vitrine posé dans le vide. Une présence pensée pour votre métier, votre zone et vos demandes de devis.
            </p>

            <div className="mt-7 grid gap-3">
              {[
                ["Site web artisan", "Rapide, mobile, premium et pensé autour de vos prestations."],
                ["Pages services & villes", "Chaque métier important et chaque zone peuvent devenir une vraie porte d’entrée."],
                ["Parcours de devis", "Avis, réalisations, appel et demande de devis placés au bon moment."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{body}</p>
                </div>
              ))}
            </div>

            <a
              href="#audit-form"
              className="audit-primary-cta mt-7 inline-flex min-h-[54px] w-full items-center justify-center rounded-[1.15rem] px-5 text-sm font-semibold"
            >
              Voir ce qu’on construirait pour mon entreprise →
            </a>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-[var(--color-accent)]/8 blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Vous avez déjà un site
            </p>
            <h3 className="font-display mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">
              On transforme l’existant.
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)] sm:text-[15px]">
              On garde ce qui fonctionne et on renforce ce qui peut vous faire trouver, choisir et contacter plus facilement.
            </p>

            <div className="mt-7 grid gap-3">
              {[
                ["Visibilité Google & locale", "Structure métier, pages locales et présence cohérente autour de votre zone."],
                ["Preuves qui rassurent", "Réalisations, avis, labels et savoir-faire rapprochés du moment de décision."],
                ["Conversion en demandes", "Boutons, appels et formulaires simplifiés pour raccourcir le chemin jusqu’au devis."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{body}</p>
                </div>
              ))}
            </div>

            <a
              href="#audit-form"
              className="mt-7 inline-flex min-h-[54px] w-full items-center justify-center rounded-[1.15rem] border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)]/50"
            >
              Analyser mon site actuel →
            </a>
          </div>
        </section>
      </div>

      <p className="mx-auto mt-6 max-w-3xl text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
        Le diagnostic n’est pas la prestation. C’est le point de départ pour savoir quoi construire, quoi garder et quoi prioriser.
      </p>
    </div>
  );
}
