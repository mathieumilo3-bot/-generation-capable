import type { BlueprintSection } from "@/lib/preview-engine/blueprint-schema";
import type { PreviewDocument } from "@/lib/preview-engine/public-view";
import { Motif, PlaceMark } from "./Motif";
import { PreviewImage } from "./PreviewImage";

/**
 * The section library. Each section renders ONLY what the validated
 * blueprint and the verified document contain; when its material is missing
 * it renders nothing rather than a placeholder. Headings start at h2: the
 * preview is embedded under the result page's single h1.
 */

export type PreviewAction = (kind: "quote" | "call", source: string) => void;
type SectionProps = { doc: PreviewDocument; onAction: PreviewAction };

function PrimaryCta({ doc, onAction, source, light = false }: SectionProps & { source: string; light?: boolean }) {
  return (
    <button type="button" className={`gcp-btn ${light ? "gcp-btn--light" : "gcp-btn--primary"}`} onClick={() => onAction("quote", source)}>
      {doc.blueprint.primaryCta.label}
      <span aria-hidden="true">→</span>
    </button>
  );
}

function CallCta({ doc, onAction, source }: SectionProps & { source: string }) {
  if (!doc.blueprint.secondaryCta || !doc.site.phone) return null;
  return (
    <button type="button" className="gcp-btn gcp-btn--ghost" onClick={() => onAction("call", source)}>
      {doc.blueprint.secondaryCta.label} · {doc.site.phone}
    </button>
  );
}

/** The short quote form the new site would carry — shown, not live. */
function QuoteForm({ doc, onAction, source }: SectionProps & { source: string }) {
  const firstService = Object.values(doc.services)[0]?.name;
  return (
    <div className="gcp-form" aria-label="Formulaire de demande de devis (aperçu)">
      <span className="gcp-field">Votre nom</span>
      <span className="gcp-field">Téléphone</span>
      <span className="gcp-field">Ville du chantier</span>
      <span className="gcp-field">{firstService ? `Type de travaux — ex. ${firstService.charAt(0).toLowerCase()}${firstService.slice(1)}` : "Type de travaux"}</span>
      <PrimaryCta doc={doc} onAction={onAction} source={source} />
    </div>
  );
}

// --- Hero -------------------------------------------------------------------

export function Hero({ doc, onAction }: SectionProps) {
  const { hero } = doc.blueprint;
  const image = hero.imageAssetId ? doc.assets[hero.imageAssetId] : undefined;
  const text = (
    <div className="gcp-hero__inner">
      <p className="gcp-eyebrow">{hero.eyebrow}</p>
      <h2 className="gcp-display gcp-hero__title">{hero.headline}</h2>
      <p className="gcp-hero__sub">{hero.subheadline}</p>
      <div className="gcp-actions">
        <PrimaryCta doc={doc} onAction={onAction} source="hero" />
        <CallCta doc={doc} onAction={onAction} source="hero" />
      </div>
    </div>
  );

  if (hero.variant === "HeroProject" && image) {
    return (
      <section className="gcp-hero" aria-label="En-tête">
        <div className="gcp-wrap gcp-hero__grid">
          {text}
          <PreviewImage src={image.src} alt={image.alt} className="gcp-media--hero" motif={doc.motif} id="hero" eager />
        </div>
      </section>
    );
  }

  if (hero.variant === "HeroLocal") {
    return (
      <section className="gcp-hero" aria-label="En-tête">
        <div className="gcp-wrap gcp-hero__grid">
          {text}
          <div className="gcp-card">
            <p className="gcp-display gcp-form__title">Votre projet{doc.site.city ? ` à ${doc.site.city}` : ""}</p>
            <p className="gcp-note" style={{ margin: "0 0 16px" }}>
              Quatre informations suffisent pour préparer votre devis.
            </p>
            <QuoteForm doc={doc} onAction={onAction} source="hero_form" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="gcp-hero gcp-hero--editorial" aria-label="En-tête">
      <Motif name={doc.motif} id="hero" className="gcp-hero__motif" />
      <div className="gcp-wrap">{text}</div>
    </section>
  );
}

// --- Trust strip ------------------------------------------------------------

export function TrustStrip({ doc }: SectionProps) {
  const { proof } = doc.blueprint;
  const items: { title: string; detail: string }[] = [];
  for (const id of proof.reviewIds) {
    const review = doc.reviews.find((r) => r.id === id);
    if (!review) continue;
    items.push(
      review.rating
        ? { title: `${review.rating}`, detail: `${review.count ? `${review.count} · ` : ""}${review.platform}` }
        : { title: `Avis ${review.platform}`, detail: "Profil public de l’entreprise" }
    );
  }
  for (const id of proof.trustIds) {
    const item = doc.trust.find((t) => t.id === id);
    if (item) items.push({ title: item.label, detail: item.kind === "insurance" ? "Assurance" : "Qualification" });
  }
  if (doc.site.foundedYear && items.length < 4) items.push({ title: `Depuis ${doc.site.foundedYear}`, detail: "Date d’immatriculation" });
  if (doc.site.siren && items.length < 4) items.push({ title: "Entreprise immatriculée", detail: `SIREN ${doc.site.siren}` });
  if (doc.site.city && items.length < 4) items.push({ title: doc.site.city, detail: doc.site.postcode ? `Siège · ${doc.site.postcode}` : "Siège de l’entreprise" });
  if (items.length === 0) return null;

  return (
    <section className="gcp-trust" aria-label="Repères">
      <div className="gcp-wrap">
        <ul className="gcp-trust__list">
          {items.slice(0, 4).map((item) => (
            <li key={`${item.title}-${item.detail}`} className="gcp-trust__item">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Services ---------------------------------------------------------------

export function Services({ doc, onAction, variant }: SectionProps & { variant: string }) {
  const { services } = doc.blueprint;
  const items = services.items.filter((item) => doc.services[item.serviceId]);
  if (items.length === 0) return null;

  const header = (
    <>
      <p className="gcp-eyebrow">Prestations</p>
      <h3 className="gcp-display gcp-h2">{services.heading}</h3>
      {services.intro ? <p className="gcp-lead">{services.intro}</p> : null}
    </>
  );

  if (variant === "ServiceSpotlight") {
    const item = items[0];
    return (
      <section className="gcp-section" id="gcp-services" aria-label="Prestations">
        <div className="gcp-wrap">
          {header}
          <div className="gcp-spotlight" data-gcp-service={item.serviceId}>
            <h4 className="gcp-display">{item.title}</h4>
            {item.description ? <p className="gcp-lead">{item.description}</p> : null}
            <div className="gcp-actions">
              <PrimaryCta doc={doc} onAction={onAction} source="service" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "ServicesEditorial") {
    return (
      <section className="gcp-section" id="gcp-services" aria-label="Prestations">
        <div className="gcp-wrap">
          {header}
          <ul className="gcp-services-list">
            {items.map((item, index) => (
              <li key={item.serviceId} data-gcp-service={item.serviceId}>
                <span className="gcp-service__index">{String(index + 1).padStart(2, "0")}</span>
                <h4 className="gcp-display">{item.title}</h4>
                <p>{item.description ?? "Sur devis, selon votre projet."}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="gcp-section" id="gcp-services" aria-label="Prestations">
      <div className="gcp-wrap">
        {header}
        <div className="gcp-services-grid">
          {items.map((item, index) => (
            <article key={item.serviceId} className="gcp-service" data-gcp-service={item.serviceId}>
              <span className="gcp-service__index">{String(index + 1).padStart(2, "0")}</span>
              <h4 className="gcp-display gcp-service__title">{item.title}</h4>
              {item.description ? <p className="gcp-service__desc">{item.description}</p> : null}
              <button
                type="button"
                className="gcp-service__link"
                style={{ background: "none", border: 0, padding: "18px 0 0", textAlign: "left", cursor: "pointer", font: "inherit", fontWeight: 700 }}
                onClick={() => onAction("quote", `service_${item.serviceId}`)}
              >
                Demander un devis →
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Portfolio --------------------------------------------------------------

export function Portfolio({ doc, variant }: SectionProps & { variant: string }) {
  const assets = doc.blueprint.portfolio.assetIds.map((id) => ({ id, asset: doc.assets[id] })).filter((a) => a.asset);
  if (assets.length < 2) return null;
  const shown = variant === "PortfolioFeature" ? assets.slice(0, 3) : assets.slice(0, 6);
  const allRealisations = shown.every((a) => a.asset.kind === "realisation");
  return (
    <section className="gcp-section gcp-section--tint" id="gcp-realisations" aria-label="Réalisations">
      <div className="gcp-wrap">
        <p className="gcp-eyebrow">En images</p>
        <h3 className="gcp-display gcp-h2">{doc.blueprint.portfolio.heading}</h3>
        <div className={`gcp-portfolio ${variant === "PortfolioFeature" ? "gcp-portfolio--feature" : ""}`}>
          {shown.map(({ id, asset }) => (
            <PreviewImage key={id} src={asset.src} alt={asset.alt} motif={doc.motif} id={id} />
          ))}
        </div>
        <p className="gcp-legend">
          {allRealisations ? "Réalisations publiées sur votre site actuel." : "Photos publiées sur votre site actuel."}
        </p>
      </div>
    </section>
  );
}

// --- Why --------------------------------------------------------------------

export function Why({ doc }: SectionProps) {
  const { why } = doc.blueprint;
  if (why.points.length === 0) return null;
  return (
    <section className="gcp-section" id="gcp-pourquoi" aria-label="Pourquoi nous choisir">
      <div className="gcp-wrap">
        <p className="gcp-eyebrow">Confiance</p>
        <h3 className="gcp-display gcp-h2">{why.heading}</h3>
        <div className="gcp-why">
          {why.points.map((point) => (
            <div key={`${point.factRef}-${point.title}`} className="gcp-why__item">
              <h4 className="gcp-display">{point.title}</h4>
              <p>{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Area -------------------------------------------------------------------

export function Area({ doc }: SectionProps) {
  const area = doc.blueprint.area;
  if (!area) return null;
  return (
    <section className="gcp-section" id="gcp-zone" aria-label="Zone d’intervention">
      <div className="gcp-wrap gcp-split">
        <div>
          <p className="gcp-eyebrow">Proximité</p>
          <h3 className="gcp-display gcp-h2">{area.heading}</h3>
          <p className="gcp-lead">{area.body}</p>
        </div>
        {doc.site.city ? (
          <div className="gcp-place">
            <PlaceMark />
            <span className="gcp-place__label">
              {doc.site.city}
              {doc.site.postcode ? ` · ${doc.site.postcode}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// --- About ------------------------------------------------------------------

export function About({ doc }: SectionProps) {
  const about = doc.blueprint.about;
  if (!about) return null;
  const facts: [string, string][] = [
    ["Activité", doc.site.trade],
    ...(doc.site.city ? ([["Siège", `${doc.site.city}${doc.site.postcode ? ` (${doc.site.postcode})` : ""}`]] as [string, string][]) : []),
    ...(doc.site.foundedYear ? ([["Immatriculée en", doc.site.foundedYear]] as [string, string][]) : []),
    ...(doc.site.siren ? ([["SIREN", doc.site.siren]] as [string, string][]) : []),
  ];
  return (
    <section className="gcp-section gcp-section--tint" id="gcp-entreprise" aria-label="L’entreprise">
      <div className="gcp-wrap gcp-split">
        <div>
          <p className="gcp-eyebrow">L’entreprise</p>
          <h3 className="gcp-display gcp-h2">{about.heading}</h3>
          <p className="gcp-lead">{about.body}</p>
        </div>
        <ul className="gcp-facts">
          {facts.map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Final CTA --------------------------------------------------------------

export function FinalCta({ doc, onAction }: SectionProps) {
  const { finalCta } = doc.blueprint;
  return (
    <section className="gcp-section gcp-final" id="gcp-devis" aria-label="Demande de devis">
      <div className="gcp-wrap gcp-split">
        <div>
          <h3 className="gcp-display gcp-h2">{finalCta.heading}</h3>
          <p className="gcp-lead">{finalCta.body}</p>
        </div>
        <div className="gcp-card">
          <QuoteForm doc={doc} onAction={onAction} source="final_form" />
        </div>
      </div>
    </section>
  );
}

export function renderSection(section: BlueprintSection, props: SectionProps) {
  switch (section.type) {
    case "trust":
      return <TrustStrip key="trust" {...props} />;
    case "services":
      return <Services key="services" variant={section.variant} {...props} />;
    case "portfolio":
      return <Portfolio key="portfolio" variant={section.variant} {...props} />;
    case "why":
      return <Why key="why" {...props} />;
    case "area":
      return <Area key="area" {...props} />;
    case "about":
      return <About key="about" {...props} />;
    case "cta":
      return <FinalCta key="cta" {...props} />;
    default:
      return null;
  }
}
