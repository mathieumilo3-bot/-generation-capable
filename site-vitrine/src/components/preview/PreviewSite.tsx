"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { PreviewDocument } from "@/lib/preview-engine/public-view";
import { getBusinessUi } from "@/lib/preview-engine/trades";
import { Hero, renderSection, type PreviewAction } from "./sections";
import "./preview.css";

/**
 * The deterministic renderer: validated blueprint + verified document in,
 * page out. No HTML from the model or from the crawled sites is ever
 * injected — every node is one of our components, every string is text.
 */

export function PreviewSite({
  doc,
  onAction,
  onServiceViewed,
}: {
  doc: PreviewDocument;
  onAction?: PreviewAction;
  onServiceViewed?: (serviceId: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ui = getBusinessUi(doc.tradeFamily);
  const action: PreviewAction = onAction ?? (() => {});
  const style = {
    "--p-primary": doc.palette.primary,
    "--p-tint": doc.palette.tint,
    "--p-ink": doc.palette.ink,
    "--p-paper": doc.palette.paper,
    "--p-muted": doc.palette.muted,
    "--p-line": doc.palette.line,
  } as CSSProperties;

  useEffect(() => {
    const node = root.current;
    if (!node || !onServiceViewed || typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.gcpService;
          if (entry.isIntersecting && id && !seen.has(id)) {
            seen.add(id);
            onServiceViewed(id);
          }
        }
      },
      { threshold: 0.6 }
    );
    node.querySelectorAll("[data-gcp-service]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [doc.id, onServiceViewed]);

  const sectionTypes = new Set(doc.blueprint.sections.map((s) => s.type));
  const nav = [
    { type: "services", href: "#gcp-services", label: ui.offerNav },
    { type: "portfolio", href: "#gcp-realisations", label: ui.portfolioNav },
    { type: "area", href: "#gcp-zone", label: ui.locationNav },
    { type: "cta", href: "#gcp-devis", label: "Contact" },
  ].filter((item) => sectionTypes.has(item.type as never));

  return (
    <div ref={root} className="gcp" style={style} data-testid="preview-site">
      <header className="gcp-header">
        <div className="gcp-wrap gcp-header__bar">
          <a className="gcp-brand" href="#gcp-top" aria-label={doc.site.name}>
            {doc.site.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- the company's own logo, through the signed proxy
              <img className="gcp-brand__logo" src={doc.site.logo.src} alt={doc.site.logo.alt} loading="eager" decoding="async" />
            ) : (
              <span className="gcp-brand__name">{doc.site.name}</span>
            )}
          </a>
          <nav className="gcp-nav" aria-label="Navigation de l’aperçu">
            {nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="gcp-header__cta">
            {doc.site.phone ? <span className="gcp-header__phone">{doc.site.phone}</span> : null}
            <button type="button" className="gcp-btn gcp-btn--primary" onClick={() => action("quote", "header")}>
              {ui.primaryShort}
            </button>
          </div>
        </div>
      </header>

      <main id="gcp-top">
        <Hero doc={doc} onAction={action} />
        {doc.blueprint.sections.map((section) => renderSection(section, { doc, onAction: action }))}
      </main>

      <footer className="gcp-footer">
        <div className="gcp-wrap">
          <div className="gcp-footer__grid">
            <div>
              <p className="gcp-footer__name">{doc.site.name}</p>
              <p>{doc.site.trade}</p>
            </div>
            <div>
              {doc.site.address ? <p>{doc.site.address}</p> : doc.site.city ? <p>{`${doc.site.city}${doc.site.postcode ? ` · ${doc.site.postcode}` : ""}`}</p> : null}
              {doc.site.phone ? <p>{doc.site.phone}</p> : null}
              {doc.site.email ? <p>{doc.site.email}</p> : null}
            </div>
            <div>
              {doc.site.socials.map((social) => (
                <p key={social.url}>
                  <a href={social.url} target="_blank" rel="noopener noreferrer nofollow">
                    {social.network.charAt(0).toUpperCase() + social.network.slice(1)}
                  </a>
                </p>
              ))}
            </div>
          </div>
          <p className="gcp-footer__legal">
            {doc.site.legalName && doc.site.legalName !== doc.site.name ? `${doc.site.legalName} · ` : ""}
            {doc.site.siren ? `SIREN ${doc.site.siren} · ` : ""}Mentions légales · Confidentialité
          </p>
        </div>
      </footer>

      <div className="gcp-mobilebar">
        {doc.site.phone && doc.blueprint.secondaryCta ? (
          <button type="button" className="gcp-btn gcp-btn--ghost" onClick={() => action("call", "mobile_bar")}>
            Appeler
          </button>
        ) : null}
        <button type="button" className="gcp-btn gcp-btn--primary" onClick={() => action("quote", "mobile_bar")}>
          {doc.blueprint.primaryCta.label}
        </button>
      </div>
    </div>
  );
}
