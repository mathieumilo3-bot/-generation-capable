import { describe, expect, it } from "vitest";
import { looksLikeAutoReply, looksLikeBounce, replyHead } from "@/lib/mail/reply-text";

const ORIGINAL = "Bonjour,\n\nDans le cadre du chantier Résidence Les Tilleuls, pourriez-vous nous transmettre votre meilleure proposition ?\n\nMerci d'indiquer si possible :\n- prix ;\n- délai.";

describe("texte rédigé par le fournisseur (sans citation)", () => {
  it("Gmail français, en-tête « a écrit » coupé sur deux lignes", () => {
    const body = `Bonjour, nous ne distribuons pas cette gamme, désolé.\n\nLe lun. 22 sept. 2026 à 10:12, Camille Chiffreuse <\ncamille@entreprise.fr> a écrit :\n> ${ORIGINAL.split("\n").join("\n> ")}`;
    expect(replyHead(body)).toBe("Bonjour, nous ne distribuons pas cette gamme, désolé.");
  });

  it("Outlook : De / Envoyé", () => {
    const body = `Ci-joint notre offre valable 30 jours.\n\nCordialement\n\nDe : Camille Chiffreuse <camille@entreprise.fr>\nEnvoyé : lundi 22 septembre 2026 10:12\nÀ : devis@fournisseur.fr\nObjet : Demande de prix\n\n${ORIGINAL}`;
    expect(replyHead(body)).toBe("Ci-joint notre offre valable 30 jours.\n\nCordialement");
  });

  it("Outlook : -----Message d'origine-----", () => {
    const body = `Prix en PJ.\n-----Message d'origine-----\n${ORIGINAL}`;
    expect(replyHead(body)).toBe("Prix en PJ.");
  });

  it("anglais « On … wrote: »", () => {
    expect(replyHead(`Quote attached.\n\nOn Mon, Sep 22, 2026 at 10:12 AM Camille wrote:\n> ${ORIGINAL}`)).toBe("Quote attached.");
  });

  it("garde tout quand il n'y a pas de citation, et ne renvoie jamais vide", () => {
    expect(replyHead("Tube DN20 : 8,40 € HT le ml.")).toBe("Tube DN20 : 8,40 € HT le ml.");
    expect(replyHead(`> ${ORIGINAL}`)).toContain("Bonjour");
  });
});

describe("réponses automatiques et non-remises", () => {
  it("détecte une absence sans être trompé par le message cité", () => {
    expect(looksLikeAutoReply("Réponse automatique : absent", "Je suis absent jusqu'au 30.")).toBe(true);
    expect(looksLikeAutoReply("RE: Demande de prix", `Offre ci-jointe.\n\nLe lun. 22 sept. 2026, Camille a écrit :\n> Notre accusé de réception…`)).toBe(false);
  });

  it("détecte les avis de non-remise Gmail et Microsoft", () => {
    expect(looksLikeBounce("mailer-daemon@googlemail.com", "Delivery Status Notification (Failure)")).toBe(true);
    expect(looksLikeBounce("postmaster@entreprise.onmicrosoft.com", "Non remis : Demande de prix [PC-ABC123]")).toBe(true);
    expect(looksLikeBounce("devis@fournisseur.fr", "Undeliverable: Demande de prix")).toBe(true);
    expect(looksLikeBounce("devis@fournisseur.fr", "RE: Demande de prix [PC-ABC123]")).toBe(false);
  });
});
