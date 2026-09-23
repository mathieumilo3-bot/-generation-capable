type FetchLike = typeof fetch;

export type RegistryCandidate = {
  name: string;
  siren: string;
  city: string;
  postalCode: string;
};

export type RegistryPreflight =
  | { status: "unique"; candidates: [RegistryCandidate] }
  | { status: "ambiguous"; candidates: RegistryCandidate[] }
  | { status: "none"; candidates: [] };

type RegistryRawCompany = {
  siren?: unknown;
  nom_complet?: unknown;
  nom_raison_sociale?: unknown;
  sigle?: unknown;
  etat_administratif?: unknown;
  siege?: {
    libelle_commune?: unknown;
    commune?: unknown;
    code_postal?: unknown;
    nom_commercial?: unknown;
    liste_enseignes?: unknown;
    etat_administratif?: unknown;
  } | null;
};

const LEGAL_WORDS = new Set([
  "sarl", "sas", "sasu", "eurl", "sa", "sci", "ei", "eirl", "societe", "entreprise",
  "etablissements", "etablissement", "ets",
]);

function clean(value: unknown, max = 180): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeRegistryName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !LEGAL_WORDS.has(token))
    .join(" ")
    .trim();
}

function aliasesOf(company: RegistryRawCompany): string[] {
  const siege = company.siege ?? {};
  const enseignes = Array.isArray(siege.liste_enseignes)
    ? siege.liste_enseignes.map((item) => clean(item)).filter(Boolean)
    : [];

  return [
    clean(company.nom_complet),
    clean(company.nom_raison_sociale),
    clean(company.sigle),
    clean(siege.nom_commercial),
    ...enseignes,
  ].filter(Boolean);
}

function locationMatches(candidate: RegistryCandidate, cityHint: string): boolean {
  const raw = cityHint.trim();
  if (!raw) return true;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 5) return candidate.postalCode === digits;

  const wanted = normalizeRegistryName(raw);
  const city = normalizeRegistryName(candidate.city);
  return Boolean(wanted && city && (city === wanted || city.includes(wanted) || wanted.includes(city)));
}

export function classifyRegistryResults(
  companyName: string,
  rawResults: unknown,
  cityHint = ""
): RegistryPreflight {
  const query = normalizeRegistryName(companyName);
  if (!query || !Array.isArray(rawResults)) return { status: "none", candidates: [] };

  const exact: RegistryCandidate[] = [];
  for (const raw of rawResults) {
    if (!raw || typeof raw !== "object") continue;
    const company = raw as RegistryRawCompany;
    const siege = company.siege ?? {};

    // Closed legal units are not useful for a live commercial audit.
    if (clean(company.etat_administratif, 8).toUpperCase() === "F") continue;

    const aliases = aliasesOf(company).map(normalizeRegistryName).filter(Boolean);
    if (!aliases.includes(query)) continue;

    const siren = clean(company.siren, 20);
    if (!/^\d{9}$/.test(siren)) continue;

    const candidate: RegistryCandidate = {
      name:
        clean(company.nom_complet) ||
        clean(company.nom_raison_sociale) ||
        clean(company.sigle) ||
        companyName.trim().slice(0, 160),
      siren,
      city: clean(siege.libelle_commune) || clean(siege.commune),
      postalCode: clean(siege.code_postal, 10),
    };

    if (!locationMatches(candidate, cityHint)) continue;
    if (exact.some((item) => item.siren === candidate.siren)) continue;
    exact.push(candidate);
  }

  if (exact.length === 1) return { status: "unique", candidates: [exact[0]] };

  if (exact.length > 1) {
    const distinctLocations = new Set(
      exact.map((item) => `${normalizeRegistryName(item.city)}|${item.postalCode}`)
    );
    // A city question is useful only if the candidates actually differ geographically.
    if (!cityHint && distinctLocations.size > 1) {
      return { status: "ambiguous", candidates: exact.slice(0, 6) };
    }
  }

  return { status: "none", candidates: [] };
}

export async function lookupFrenchRegistry(
  companyName: string,
  cityHint = "",
  options: { fetchFn?: FetchLike; timeoutMs?: number } = {}
): Promise<RegistryPreflight> {
  const query = companyName.trim().slice(0, 160);
  if (query.length < 2) return { status: "none", candidates: [] };

  const fetchFn = options.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1_800);

  try {
    const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "12");
    url.searchParams.set("minimal", "true");
    url.searchParams.set("include", "siege");

    const response = await fetchFn(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { status: "none", candidates: [] };

    const payload = (await response.json()) as { results?: unknown };
    return classifyRegistryResults(query, payload.results, cityHint);
  } catch {
    // Registry lookup is an accelerator only. The existing web discovery
    // remains the fallback if data.gouv.fr is slow or temporarily unavailable.
    return { status: "none", candidates: [] };
  } finally {
    clearTimeout(timer);
  }
}

export function registryIdentityHint(candidate: RegistryCandidate): string {
  return [
    `SIREN ${candidate.siren}`,
    candidate.name ? `raison sociale/nom public ${candidate.name}` : "",
    candidate.city ? `siège ${candidate.city}` : "",
    candidate.postalCode ? `code postal ${candidate.postalCode}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 360);
}
