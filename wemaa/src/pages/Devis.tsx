import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { quotePage } from "../data/content";
import { Reveal } from "../components/Reveal";

const perkIcons = ["⏱", "✦", "◎"];

const inputClasses =
  "w-full rounded-lg border border-ivoire/15 bg-noir-soft px-4 py-3 text-sm text-ivoire placeholder:text-ivoire/30 outline-none transition-colors duration-300 focus:border-or";

const labelClasses = "mb-2 block text-xs font-medium tracking-[0.15em] text-ivoire/60";

export function Devis() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    setSubmitting(true);
    // Démo front-end : aucune API n'est branchée ici. À connecter à votre
    // service d'envoi (email, CRM…) avant mise en production.
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 900);
  };

  return (
    <div className="min-h-screen bg-noir pt-40 pb-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.35em] text-or">
            <span className="h-px w-8 bg-or" />
            DEVIS
          </p>
          <h1 className="text-balance font-serif text-4xl leading-tight text-ivoire sm:text-5xl">{quotePage.title}</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ivoire/70">{quotePage.subtitle}</p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
          <Reveal>
            {submitted ? (
              <div className="flex flex-col items-start gap-5 rounded-2xl border border-or/25 bg-noir-soft p-10">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-or text-2xl text-or">
                  ✓
                </span>
                <h2 className="font-serif text-2xl text-ivoire">Votre demande a bien été envoyée.</h2>
                <p className="max-w-md text-sm leading-relaxed text-ivoire/70">
                  Merci pour ces informations. Notre équipe revient vers vous sous 24 à 48h pour échanger
                  sur votre projet.
                </p>
                <Link
                  to="/"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-or transition-colors hover:text-or-clair"
                >
                  ← Retour à l'accueil
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="eventType" className={labelClasses}>
                      Type d'événement *
                    </label>
                    <select id="eventType" name="eventType" required defaultValue="" className={inputClasses}>
                      <option value="" disabled>
                        Sélectionnez un type
                      </option>
                      {quotePage.eventTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="eventDate" className={labelClasses}>
                      Date de l'événement
                    </label>
                    <input id="eventDate" name="eventDate" type="date" className={inputClasses} />
                  </div>

                  <div>
                    <label htmlFor="guests" className={labelClasses}>
                      Nombre d'invités
                    </label>
                    <input
                      id="guests"
                      name="guests"
                      type="number"
                      min={1}
                      placeholder="Ex. 120"
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <label htmlFor="budget" className={labelClasses}>
                      Budget approximatif
                    </label>
                    <select id="budget" name="budget" defaultValue="" className={inputClasses}>
                      <option value="" disabled>
                        Sélectionnez une fourchette
                      </option>
                      {quotePage.budgets.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="name" className={labelClasses}>
                      Nom *
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="Votre nom"
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className={labelClasses}>
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="vous@exemple.com"
                      className={inputClasses}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="phone" className={labelClasses}>
                      Téléphone *
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="06 12 34 56 78"
                      className={inputClasses}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="message" className={labelClasses}>
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      placeholder="Parlez-nous de votre projet, de vos envies, du lieu envisagé..."
                      className={`${inputClasses} resize-none`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-or-clair to-or px-8 py-3.5 text-sm font-medium tracking-wide text-noir shadow-[0_8px_30px_-10px_rgba(198,161,91,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-8px_rgba(198,161,91,0.8)] disabled:opacity-60"
                >
                  {submitting ? "Envoi en cours..." : quotePage.submitLabel}
                  {!submitting && (
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  )}
                </button>
              </form>
            )}
          </Reveal>

          <Reveal delay={150} className="flex flex-col gap-4">
            {quotePage.perks.map((perk, i) => (
              <div
                key={perk.title}
                className="flex items-start gap-4 rounded-xl border border-or/15 bg-noir-soft p-6"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-or/40 text-or">
                  {perkIcons[i]}
                </span>
                <div>
                  <p className="text-sm font-medium text-ivoire">{perk.title}</p>
                  <p className="mt-1 text-xs text-ivoire/60">{perk.detail}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </div>
  );
}
