import { describe, expect, it } from "vitest";
import { extractAssets, imageKey, pickFromSrcset } from "../assets";
import { contrast, derivePalette, rankObservedColors } from "../colors";
import { detectTradeFamily } from "../trades";
import { displayCase } from "../profile";

const HOME = `<html><head><meta name="theme-color" content="#1d4e89"><meta property="og:site_name" content="Toiture Martin">
<style>:root{--e-global-color-primary:#1d4e89}.x{color:#eeeeee;background:#ffffff}</style>
<link rel="stylesheet" href="/wp-content/themes/t/style.css"></head><body>
<header><img class="custom-logo" src="/logo-toiture-martin.png" alt="Toiture Martin"><img src="/uploads/banniere-2000x800.jpg"></header>
<main><img src="/uploads/icone-fleche.png" width="24" height="24"><img src="/uploads/qualibat-logo.jpg" width="400" height="300">
<img data-src="/uploads/chantier-1-1024x768.jpg" src="data:image/gif;base64,R0lGOD" alt="Toiture refaite" width="1024" height="768">
<img srcset="/uploads/chantier-2-300x200.jpg 300w, /uploads/chantier-2-1200x800.jpg 1200w, /uploads/chantier-2-2400x1600.jpg 2400w" alt="Chantier 2">
<img src="/uploads/tiny-150x150.jpg"><div style="background-image:url('/uploads/hero-1920x1080.jpg')"></div>
<p>Note 4,9/5 sur Google — 37 avis</p><a href="mailto:contact@toiture-martin.test">écrire</a></main></body></html>`;

describe("asset extraction", () => {
  const assets = extractAssets([{ url: "https://toiture-martin.test/", kind: "home", html: HOME }], { brandName: "Toiture Martin" });

  it("finds the header logo, never counts it as a photo", () => {
    expect(assets.logo?.url).toBe("https://toiture-martin.test/logo-toiture-martin.png");
    expect(assets.images.some((i) => i.url.includes("logo"))).toBe(false);
  });

  it("keeps real photos (lazy, srcset, background) and drops icons, labels and thumbnails", () => {
    const urls = assets.images.map((i) => i.url);
    expect(urls).toContain("https://toiture-martin.test/uploads/chantier-1-1024x768.jpg");
    expect(urls).toContain("https://toiture-martin.test/uploads/chantier-2-1200x800.jpg");
    expect(urls).toContain("https://toiture-martin.test/uploads/hero-1920x1080.jpg");
    expect(urls.some((u) => /fleche|qualibat|tiny|banniere/.test(u))).toBe(false);
  });

  it("reads the site's own review score, e-mail, theme colour and name", () => {
    expect(assets.reviewMentions[0]).toMatchObject({ rating: "4,9/5", count: "37 avis", platform: "Google" });
    expect(assets.emails).toEqual(["contact@toiture-martin.test"]);
    expect(assets.themeColor).toBe("#1d4e89");
    expect(assets.siteName).toBe("Toiture Martin");
    expect(assets.stylesheetUrls[0]).toContain("style.css");
  });

  it("collapses the sizes of one photo and picks a sensible srcset candidate", () => {
    expect(imageKey("https://a.fr/x/photo-300x200.jpg")).toBe(imageKey("https://a.fr/x/photo-1200x800.jpg"));
    expect(pickFromSrcset("a.jpg 300w, b.jpg 1200w, c.jpg 2400w")?.url).toBe("b.jpg");
  });
});

describe("colours", () => {
  it("ranks brand colours first and ignores greys", () => {
    const ranked = rankObservedColors([":root{--primary:#c0392b} body{color:#333;background:#fafafa} a{color:#c0392b} .b{color:#2e86de}"]);
    expect(ranked[0]).toBe("#c0392b");
    expect(ranked).not.toContain("#333333");
  });

  it("always yields a primary that carries white text at AA contrast", () => {
    for (const observed of [["#ffd84d"], ["#7fd1ae"], [], null]) {
      const palette = derivePalette(observed, "#3d4b5c");
      expect(contrast(palette.primary, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
    expect(derivePalette(["#ffd84d"], "#3d4b5c").source).toBe("brand");
    expect(derivePalette([], "#3d4b5c").source).toBe("trade");
  });
});

describe("trade families and casing", () => {
  it("uses NAF, sector and services", () => {
    expect(detectTradeFamily({ naf: "43.91B" })).toBe("couverture_charpente");
    expect(detectTradeFamily({ sector: "Plombier / chauffagiste" })).toBe("plomberie_chauffage");
    expect(detectTradeFamily({ services: ["aménagement paysager", "entretien de jardin"] })).toBe("paysagiste");
    expect(detectTradeFamily({})).toBe("entreprise_generale");
  });

  it("title-cases registry capitals but keeps acronyms", () => {
    expect(displayCase("SAINT-CHRISTOPHE-DU-LIGNERON")).toBe("Saint-Christophe-du-Ligneron");
    expect(displayCase("AATP")).toBe("AATP");
    expect(displayCase("TROJANI.P")).toBe("Trojani.P");
    expect(displayCase("CJ MENUISERIE")).toBe("CJ Menuiserie");
    expect(displayCase("Menuiserie Piau")).toBe("Menuiserie Piau");
  });
});
