import type { CSSProperties } from "react";
import type { BlueprintSection } from "@/lib/preview-engine/blueprint-schema";
import type { PreviewDocument } from "@/lib/preview-engine/public-view";
import { getBusinessUi } from "@/lib/preview-engine/trades";
import { Motif } from "./Motif";
import { PreviewImage } from "./PreviewImage";

/**
 * The section library ("Atelier"). Each section renders ONLY what the
 * validated blueprint and the verified document contain; when its material
 * is missing it renders nothing rather than a placeholder. Headings start at
 * h2: the preview is embedded under the result page's single h1.
 */

export type PreviewAction = (kind: "quote" | "call", source: string) => void;
type SectionProps = { doc: PreviewDocument; onAction: PreviewAction };

const SMALL = new Set(["de", "du", "des", "la", "le", "les", "et", "l", "d", "sarl", "sas", "sasu", "eurl", "sa", "ets"]);

/** Initials drawn from the company's own name — a typographic mark, never an invented logo. */
export function monogram(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !SMALL.has(w.toLowerCase()));
  if (words.length === 0) return "";
  if (words.length === 1 && words[0].length <= 4 && words[0] === words[0].toUpperCase()) return words[0];
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Monumental type that still fits: sized on the longest unbreakable part of the text. */
function monumentalSize(text: string, factor: number, max: string): string {
  const longest = Math.max(4, ...text.split(/[\s-]+/).map((w) => w.length));
  // Long lines get a lower ceiling: monumental, never a wall of type.
  const ceiling = text.length > 40 ? "4.4rem" : text.length > 26 ? "5.2rem" : max;
  return `clamp(2.4rem, ${Math.round((factor / (longest + 1.5)) * 10) / 10}cqi, ${ceiling})`;
}

function PrimaryCta({ doc, onAction, source, tone = "primary" }: SectionProps & { source: string; tone?: "primary" | "white" }) {
  return (
    <button type="button" className={`gcp-btn gcp-btn--${tone}`} onClick={() => onAction("quote", source)}>
      {doc.blueprint.primaryCta.label}
    </button>
  );
}

function CallCta({ doc, onAction, source, tone = "ghost" }: SectionProps & { source: string; tone?: "ghost" | "glass" }) {
  if (!doc.blueprint.secondaryCta || !doc.site.phone) return null;
  return (
    <button type="button" className={`gcp-btn gcp-btn--${tone}`} onClick={() => onAction("call", source)}>
      {doc.blueprint.secondaryCta.label} · {doc.site.phone}
    </button>
  );
}

/** The short quote form the new site would carry — shown, not live. */
function QuoteForm({ doc, onAction, source }: SectionProps & { source: string }) {
  const firstService = Object.values(doc.services)[0]?.name;
  const ui = getBusinessUi(doc.tradeFamily);
  return (
    <div className="gcp-form" aria-label={ui.formAria}>
      <p className="gcp-display gcp-form__title">{ui.formTitle}{doc.site.city && ui.showArea ? ` · ${doc.site.city}` : ""}</p>
      <p className="gcp-note" style={{ margin: "0 0 8px" }}>
        {ui.formIntro}
      </p>
      <span className="gcp-field">Votre nom</span>
      <span className="gcp-field">Téléphone</span>
      <span className="gcp-field">{ui.locationField}</span>
      <span className="gcp-field">
        {firstService ? `${ui.offerField} — ex. ${firstService.charAt(0).toLowerCase()}${firstService.slice(1)}` : ui.offerField}
      </span>
      <PrimaryCta doc={doc} onAction={onAction} source={source} />
    </div>
  );
}

// --- Hero -------------------------------------------------------------------

export function Hero({ doc, onAction }: SectionProps) {
  const { hero } = doc.blueprint;
  const image = hero.imageAssetId ? doc.assets[hero.imageAssetId] : undefined;

  // A real photo of the company always carries the hero: it is the strongest proof there is.
  if (image) {
    return (
      <section className="gcp-hero-photo" aria-label="En-tête">
        <div className="gcp-hero-photo__frame">
          <PreviewImage src={image.src} alt={image.alt} motif={doc.motif} id="hero" eager />
          <div className="gcp-hero-photo__shade" aria-hidden="true" />
          {image.kind === "realisation" ? <span className="gcp-hero-photo__caption">{image.caption}</span> : null}
          <div className="gcp-hero-photo__content">
            <p className="gcp-eyebrow">{hero.eyebrow}</p>
            <h2 className="gcp-display gcp-hero__title" style={{ maxWidth: "14ch" }}>
              {hero.headline}
            </h2>
            <p className="gcp-hero__sub">{hero.subheadline}</p>
            <div className="gcp-actions">
              <PrimaryCta doc={doc} onAction={onAction} source="hero" tone="white" />
              <CallCta doc={doc} onAction={onAction} source="hero" tone="glass" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const facts = [doc.site.trade, doc.site.city ? `Basée à ${doc.site.city}` : "", doc.site.foundedYear ? `Depuis ${doc.site.foundedYear}` : "", doc.site.phone ?? ""].filter(
    Boolean
  );
  const mark = monogram(doc.site.name);

  return (
    <section aria-label="En-tête">
      <div className="gcp-hero-type gcp-wrap">
        <p className="gcp-eyebrow">{hero.eyebrow}</p>
        <h2 className="gcp-display gcp-hero__title" style={{ fontSize: monumentalSize(hero.headline, 150, "6.2rem") }}>
          {hero.headline}
        </h2>
        <p className="gcp-hero__sub">{hero.subheadline}</p>
        <div className="gcp-actions gcp-actions--center">
          <PrimaryCta doc={doc} onAction={onAction} source="hero" />
          <CallCta doc={doc} onAction={onAction} source="hero" />
        </div>
      </div>
      <div className="gcp-panel">
        <Motif name={doc.motif} id="panel" className="gcp-panel__motif" />
        <div style={{ position: "relative" }}>
          {mark ? (
            <div className="gcp-monogram" aria-hidden="true">
              {mark}
            </div>
          ) : null}
          <ul className="gcp-panel__facts" aria-label="Repères">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
        <div className="gcp-card">
          <QuoteForm doc={doc} onAction={onAction} source="hero_form" />
        </div>
      </div>
    </section>
  );
}

// --- Key figures ------------------------------------------------------------

export function TrustStrip({ doc }: SectionProps) {
  const { proof } = doc.blueprint;
  const items: { title: string; detail: string }[] = [];
  for (const id of proof.reviewIds) {
    const review = doc.reviews.find((r) => r.id === id);
    if (!review) continue;
    items.push(
      review.rating
        ? { title: review.rating, detail: `${review.count ? `${review.count} · ` : ""}${review.platform}` }
        : { title: `Avis ${review.platform}`, detail: "Profil public de l’entreprise" }
    );
  }
  for (const id of proof.trustIds) {
    const item = doc.trust.find((t) => t.id === id);
    if (item) items.push({ title: item.label, detail: item.kind === "insurance" ? "Assurance" : "Qualification" });
  }
  if (doc.site.foundedYear && items.length < 4) items.push({ title: `Depuis ${doc.site.foundedYear}`, detail: "Date d’immatriculation" });
  if (doc.site.city && doc.site.city.length <= 16 && items.length < 4) {
    items.push({ title: doc.site.city, detail: doc.site.postcode ? `Siège · ${doc.site.postcode}` : "Siège de l’entreprise" });
  }
  if (doc.site.siren && items.length < 4) items.push({ title: "Immatriculée", detail: `SIREN ${doc.site.siren}` });
  if (items.length === 0) return null;
  const shown = items.slice(0, 4);

  return (
    <section className="gcp-figures" aria-label="Repères">
      <div className="gcp-wrap">
        <ul className="gcp-figures__list gcp-reveal" style={{ "--p-figures": shown.length } as CSSProperties}>
          {shown.map((item) => (
            <li key={`${item.title}-${item.detail}`} className="gcp-figure">
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
  const ui = getBusinessUi(doc.tradeFamily);
  const items = services.items.filter((item) => doc.services[item.serviceId]);
  if (items.length === 0) return null;

  const header = (
    <div className="gcp-head gcp-reveal">
      <p className="gcp-eyebrow">{ui.serviceEyebrow}</p>
      <h3 className="gcp-display gcp-h2">{services.heading}</h3>
      {services.intro ? <p className="gcp-lead">{services.intro}</p> : null}
    </div>
  );

  if (variant === "ServicesEditorial") {
    return (
      <section className="gcp-section" id="gcp-services" aria-label="Prestations">
        <div className="gcp-wrap">
          {header}
          <ul className="gcp-list">
            {items.map((item, index) => (
              <li key={item.serviceId} data-gcp-service={item.serviceId} className="gcp-reveal">
                <span className="gcp-tile__index">{String(index + 1).padStart(2, "0")}</span>
                <h4 className="gcp-display">{item.title}</h4>
                <p>{item.description ?? ui.serviceFallback}</p>
                <button type="button" className="gcp-link" onClick={() => onAction("quote", `service_${item.serviceId}`)}>
                  {ui.serviceAction} <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  const tiles = variant === "ServiceSpotlight" ? items.slice(0, 1) : items;
  return (
    <section className="gcp-section" id="gcp-services" aria-label="Prestations">
      <div className="gcp-wrap">
        {header}
        <div className={variant === "ServiceSpotlight" ? "gcp-spotlight" : "gcp-bento"} data-count={tiles.length}>
          {tiles.map((item, index) => (
            <article key={item.serviceId} className="gcp-tile gcp-reveal" data-gcp-service={item.serviceId}>
              <span className="gcp-tile__index">{String(index + 1).padStart(2, "0")}</span>
              <h4 className="gcp-display gcp-tile__title">{item.title}</h4>
              {item.description ? <p className="gcp-tile__desc">{item.description}</p> : null}
              <button type="button" className="gcp-link" onClick={() => onAction("quote", `service_${item.serviceId}`)}>
                {ui.serviceAction} <span aria-hidden="true">›</span>
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
  const ui = getBusinessUi(doc.tradeFamily);
  const assets = doc.blueprint.portfolio.assetIds.map((id) => ({ id, asset: doc.assets[id] })).filter((a) => a.asset);
  if (assets.length < 2) return null;
  const shown = variant === "PortfolioFeature" ? assets.slice(0, 3) : assets.slice(0, 6);
  const allRealisations = shown.every((a) => a.asset.kind === "realisation");
  return (
    <section className="gcp-section gcp-section--tint" id="gcp-realisations" aria-label={ui.portfolioNav}>
      <div className="gcp-wrap">
        <div className="gcp-head gcp-reveal">
          <p className="gcp-eyebrow">En images</p>
          <h3 className="gcp-display gcp-h2">{doc.blueprint.portfolio.heading}</h3>
        </div>
        <div className="gcp-mosaic gcp-reveal">
          {shown.map(({ id, asset }) => (
            <PreviewImage key={id} src={asset.src} alt={asset.alt} motif={doc.motif} id={id} />
          ))}
        </div>
        <p className="gcp-legend">{allRealisations ? `${ui.portfolioNav} · visuels publiés sur votre site actuel.` : "Photos publiées sur votre site actuel."}</p>
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
      <div className="gcp-wrap gcp-why">
        <div className="gcp-why__head gcp-reveal">
          <p className="gcp-eyebrow">Confiance</p>
          <h3 className="gcp-display gcp-h2">{why.heading}</h3>
        </div>
        <ol className="gcp-why__list">
          {why.points.map((point, index) => (
            <li key={`${point.factRef}-${point.title}`} className="gcp-reveal">
              <span className="gcp-why__num">{String(index + 1).padStart(2, "0")}</span>
              <h4 className="gcp-display">{point.title}</h4>
              <p>{point.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// --- Area -------------------------------------------------------------------

export function Area({ doc }: SectionProps) {
  const ui = getBusinessUi(doc.tradeFamily);
  const area = doc.blueprint.area;
  if (!area) return null;
  const city = doc.site.city;
  return (
    <section className="gcp-section" id="gcp-zone" aria-label={ui.locationNav}>
      <div className="gcp-wrap">
        <h3 className="gcp-eyebrow gcp-reveal">{area.heading}</h3>
        {city ? (
          <p className="gcp-city gcp-reveal" aria-hidden="true" style={{ fontSize: monumentalSize(city, 125, "11rem") }}>
            {city}
            <span>.</span>
          </p>
        ) : null}
        <div className="gcp-area gcp-reveal">
          <p className="gcp-quote">{area.body}</p>
          {city ? (
            <p className="gcp-area__meta">
              Siège : {city}
              {doc.site.postcode ? ` · ${doc.site.postcode}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- About ------------------------------------------------------------------

export function About({ doc }: SectionProps) {
  const about = doc.blueprint.about;
  if (!about) return null;
  const facts: [string, string][] = [["Activité", doc.site.trade]];
  if (doc.site.city) facts.push(["Siège", `${doc.site.city}${doc.site.postcode ? ` (${doc.site.postcode})` : ""}`]);
  if (doc.site.foundedYear) facts.push(["Immatriculée en", doc.site.foundedYear]);
  if (doc.site.siren) facts.push(["SIREN", doc.site.siren]);
  return (
    <section className="gcp-section gcp-section--tint" id="gcp-entreprise" aria-label="L’entreprise">
      <div className="gcp-wrap gcp-split">
        <div className="gcp-reveal">
          <p className="gcp-eyebrow">L’entreprise</p>
          <h3 className="gcp-display gcp-h2">{about.heading}</h3>
          <p className="gcp-lead">{about.body}</p>
        </div>
        <ul className="gcp-facts gcp-reveal">
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
  const ui = getBusinessUi(doc.tradeFamily);
  const { finalCta } = doc.blueprint;
  return (
    <section className="gcp-section gcp-final" id="gcp-devis" aria-label={ui.primaryCta}>
      <div className="gcp-wrap">
        <div className="gcp-head gcp-head--center gcp-reveal">
          <h3 className="gcp-display gcp-h2">{finalCta.heading}</h3>
          <p className="gcp-lead">{finalCta.body}</p>
        </div>
        <div className="gcp-card gcp-reveal">
          <QuoteForm doc={doc} onAction={onAction} source="final_form" />
        </div>
        {doc.site.phone && doc.blueprint.secondaryCta ? (
          <p className="gcp-final__phone">
            Ou appelez directement le <strong>{doc.site.phone}</strong>
          </p>
        ) : null}
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
