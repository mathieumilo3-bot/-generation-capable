import { describe, expect, it } from "vitest";
import { parseHtmlSignals, resolveTargetUrl } from "./probe";

describe("resolveTargetUrl", () => {
  it("accepts a full https URL as-is", () => {
    const result = resolveTargetUrl("https://mon-restaurant.fr");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.toString()).toBe("https://mon-restaurant.fr/");
  });

  it("adds https:// to a bare domain", () => {
    const result = resolveTargetUrl("mon-restaurant.fr");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.protocol).toBe("https:");
  });

  it("accepts a social profile URL (visitor with no site yet)", () => {
    const result = resolveTargetUrl("instagram.com/monrestaurant");
    expect(result.ok).toBe(true);
  });

  it("rejects empty input without throwing", () => {
    expect(resolveTargetUrl("").ok).toBe(false);
    expect(resolveTargetUrl("   ").ok).toBe(false);
  });

  it("rejects a host with no TLD (not a fetchable site)", () => {
    const result = resolveTargetUrl("monentreprise");
    expect(result.ok).toBe(false);
  });

  it("blocks loopback and private-network targets (SSRF guard)", () => {
    for (const target of [
      "http://localhost/admin",
      "http://127.0.0.1:8080",
      "http://10.0.0.5",
      "http://192.168.1.1",
      "http://169.254.169.254/latest/meta-data", // cloud metadata endpoint
      "http://[::1]",
    ]) {
      const result = resolveTargetUrl(target);
      expect(result.ok, `${target} should be blocked`).toBe(false);
      if (!result.ok) expect(result.reason).toBe("blocked_target");
    }
  });

  it("rejects non-http(s) schemes", () => {
    const result = resolveTargetUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
  });

  it("does not falsely block an ordinary public domain", () => {
    expect(resolveTargetUrl("https://generationcapable.fr").ok).toBe(true);
    expect(resolveTargetUrl("https://192.0.2.1.example.com").ok).toBe(true);
  });
});

describe("parseHtmlSignals", () => {
  const richPage = `<!doctype html>
<html lang="fr">
<head>
  <title>Le Bistrot du Coin — Restaurant à Lyon</title>
  <meta name="description" content="Réservez votre table au Bistrot du Coin, cuisine traditionnelle à Lyon.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">{"@type":"Restaurant"}</script>
</head>
<body>
  <h1>Le Bistrot du Coin</h1>
  <p>Réservez votre table en ligne dès maintenant. Menu à partir de 25€.</p>
  <a href="tel:+33478000000">Appelez-nous</a>
  <a href="mailto:contact@bistrot.fr">Écrivez-nous</a>
  <a href="https://www.instagram.com/bistrotducoin">Instagram</a>
  <a href="https://www.facebook.com/bistrotducoin">Facebook</a>
  <form><input name="reservation"></form>
  <section>★★★★★ Avis clients : "Excellent accueil" — Marie</section>
  <section>Questions fréquentes sur la réservation</section>
  <footer><a href="/mentions-legales">Mentions légales</a></footer>
</body>
</html>`;

  it("extracts every OBSERVED signal from a content-rich page", () => {
    const signals = parseHtmlSignals(richPage);
    expect(signals.title.confidence).toBe("observed");
    expect(signals.title.value).toContain("Le Bistrot du Coin");
    expect(signals.metaDescription.value).toContain("Réservez");
    expect(signals.h1.value).toEqual(["Le Bistrot du Coin"]);
    expect(signals.hasViewportMeta.value).toBe(true);
    expect(signals.hasHtmlLangAttr.value).toBe(true);
    expect(signals.hasStructuredData.value).toBe(true);
    expect(signals.telLinkCount.value).toBe(1);
    expect(signals.mailtoLinkCount.value).toBe(1);
    expect(signals.formCount.value).toBe(1);
    expect(signals.socialLinks.value).toMatchObject({
      instagram: expect.stringContaining("instagram.com/bistrotducoin"),
      facebook: expect.stringContaining("facebook.com/bistrotducoin"),
    });
    expect(signals.actionWords.value).toContain("réservation");
    expect(signals.actionWords.value).toContain("appelez");
    expect(signals.priceMentionCount.value).toBeGreaterThanOrEqual(1);
    expect(signals.testimonialSignalCount.value).toBeGreaterThan(0);
    expect(signals.faqSignalPresent.value).toBe(true);
    expect(signals.legalNoticeLinkPresent.value).toBe(true);
  });

  it("marks every content signal UNKNOWN on a near-empty page, never fabricating a value", () => {
    const emptyPage = "<html><head></head><body></body></html>";
    const signals = parseHtmlSignals(emptyPage);
    expect(signals.title.confidence).toBe("unknown");
    expect(signals.title.value).toBeNull();
    expect(signals.metaDescription.confidence).toBe("unknown");
    expect(signals.h1.confidence).toBe("unknown");
    expect(signals.socialLinks.confidence).toBe("unknown");
    expect(signals.actionWords.confidence).toBe("unknown");
    // Structural booleans are still OBSERVED — "no viewport meta" is itself
    // an observation, not a missing one.
    expect(signals.hasViewportMeta.confidence).toBe("observed");
    expect(signals.hasViewportMeta.value).toBe(false);
  });

  it("never crashes on malformed or partial markup", () => {
    expect(() => parseHtmlSignals("<html><title>Unclosed")).not.toThrow();
    expect(() => parseHtmlSignals("")).not.toThrow();
    expect(() => parseHtmlSignals("<<<>>>not html at all>>>")).not.toThrow();
  });

  it("strips script and style content out of the readable text and word count", () => {
    const page = `<html><body><script>var secret = "should not count as words";</script><style>.x{color:red}</style><p>Bonjour le monde</p></body></html>`;
    const signals = parseHtmlSignals(page);
    expect(signals.wordCount.value).toBe(3);
  });
});
