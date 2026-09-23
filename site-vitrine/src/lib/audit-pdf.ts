import type { AuditSubmission, ReportEmailSummary } from "@/lib/audit-submission";

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapAfter?: number;
};

function clean(value: string): string {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/✓/g, "OK")
    .replace(/€/g, "EUR")
    .replace(/[^\x20-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdf(value: string): string {
  return clean(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, maxChars: number): string[] {
  const words = clean(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function textCommands(lines: PdfLine[]): string {
  let y = 790;
  const parts: string[] = [];
  for (const line of lines) {
    const size = line.size ?? 11;
    const font = line.bold ? "F2" : "F1";
    const maxChars = size >= 20 ? 48 : size >= 14 ? 65 : 88;
    const wrapped = wrap(line.text, maxChars);

    for (const row of wrapped) {
      if (y < 55) break;
      parts.push(`BT /${font} ${size} Tf 54 ${y} Td (${escapePdf(row)}) Tj ET`);
      y -= Math.max(size + 5, 16);
    }
    y -= line.gapAfter ?? 5;
  }
  return parts.join("\n");
}

function object(id: number, body: string): string {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function streamObject(id: number, stream: string): string {
  const bytes = Buffer.from(stream, "latin1");
  return `${id} 0 obj\n<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
}

function filenamePart(value: string): string {
  return clean(value || "entreprise")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "entreprise";
}

export function buildAuditPdf(
  submission: AuditSubmission,
  summary: ReportEmailSummary | null
): { filename: string; content: Buffer } {
  const priorities = summary?.topLeaks.slice(0, 3) ?? [];
  const company = submission.entreprise || submission.siteUrl || "Votre entreprise";
  const goal = submission.objectif || "Developper les opportunites commerciales";

  const page1: PdfLine[] = [
    { text: "GC - DIAGNOSTIC ACQUISITION, VISIBILITE & CONVERSION", size: 10, bold: true, gapAfter: 12 },
    { text: company, size: 24, bold: true, gapAfter: 4 },
    { text: `Objectifs declares : ${goal}`, size: 11, gapAfter: 16 },
    { text: "Les points qui influencent votre capacite a etre trouve, choisi, contacte et a recevoir des demandes mieux qualifiees.", size: 15, bold: true, gapAfter: 18 },
    { text: "01 - ATTIRER", size: 13, bold: true },
    { text: "Etes-vous visible lorsqu'un prospect recherche votre metier, vos services ou votre zone sans connaitre votre nom ?", size: 11, gapAfter: 10 },
    { text: "02 - RASSURER", size: 13, bold: true },
    { text: "Lorsqu'un prospect vous decouvre, comprend-il rapidement votre offre et trouve-t-il des preuves suffisantes pour vous faire confiance ?", size: 11, gapAfter: 10 },
    { text: "03 - CONVERTIR", size: 13, bold: true },
    { text: "Une personne interessee sait-elle immediatement quoi faire pour demander un devis, appeler ou avancer avec vous ?", size: 11, gapAfter: 18 },
    { text: "LE POINT CENTRAL", size: 12, bold: true },
    { text: "La visibilite n'a de valeur que si elle cree des opportunites commerciales. Notre analyse suit le parcours : recherche -> decouverte -> comprehension -> confiance -> action.", size: 11 },
  ];

  const page2: PdfLine[] = [
    { text: "3 PRIORITES. PAS 20.", size: 20, bold: true, gapAfter: 12 },
    { text: "Nous retenons uniquement les points capables d'ameliorer la visibilite utile, la confiance ou la transformation en demande qualifiee.", size: 11, gapAfter: 14 },
  ];

  if (priorities.length) {
    priorities.forEach((item, index) => {
      page2.push(
        { text: `${String(index + 1).padStart(2, "0")} - ${item.title}`, size: 14, bold: true, gapAfter: 2 },
        { text: `SITUATION / ECART : ${item.statement || "Point a verifier dans le parcours prospect."}`, size: 10, gapAfter: 2 },
        { text: `DECISION PRIORITAIRE : ${item.recommendation || "Definir l'action la plus rentable a lancer en premier."}`, size: 10, gapAfter: 10 },
      );
    });
  } else {
    page2.push(
      { text: "Le diagnostic detaille n'a pas pu etre finalise automatiquement.", size: 13, bold: true, gapAfter: 6 },
      { text: "Nous avons conserve les informations de votre entreprise et vos objectifs afin de reprendre l'analyse pendant l'echange GC.", size: 11 }
    );
  }

  const page3: PdfLine[] = [
    { text: "LE PARCOURS A CONSTRUIRE", size: 20, bold: true, gapAfter: 12 },
    { text: "01 - RECHERCHE : le prospect exprime un besoin.", size: 11 },
    { text: "02 - DECOUVERTE : il trouve votre entreprise.", size: 11 },
    { text: "03 - COMPREHENSION : il comprend rapidement l'offre.", size: 11 },
    { text: "04 - CONFIANCE : il voit les preuves pertinentes.", size: 11 },
    { text: "05 - QUALIFICATION : la demande contient assez de contexte pour etre exploitable.", size: 11 },
    { text: "06 - ACTION : le prospect sait exactement quoi faire et l'entreprise sait quoi rappeler.", size: 11, gapAfter: 18 },
    { text: "PRIORITE", size: 13, bold: true },
    { text: "Le but n'est pas de tout changer. Le but est de corriger ce qui bloque le plus, puis de mesurer.", size: 11, gapAfter: 18 },
    { text: "ECHANGE GC", size: 13, bold: true },
    { text: "Nous pouvons reprendre ces trois priorites, les classer par impact et definir l'ordre exact des actions a lancer.", size: 11, gapAfter: 8 },
    { text: "30 minutes - Analyse - Plan d'action priorise", size: 12, bold: true },
    { text: "Le lien de reservation est disponible dans l'email qui accompagne ce PDF.", size: 10 },
  ];

  const pages = [page1, page2, page3];
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 5;

  for (const page of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const content = textCommands(page);
    objects.push(
      object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`)
    );
    objects.push(streamObject(contentId, content));
  }

  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  const headerObjects = [
    object(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>`),
    object(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
  ];

  const allObjects = [...headerObjects, ...objects];
  let pdf = "%PDF-1.4\n%GC-AUDIT\n";
  const offsets: number[] = [0];

  for (const item of allObjects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += item;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  const maxId = allObjects.length;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return {
    filename: `audit-gc-${filenamePart(company)}.pdf`,
    content: Buffer.from(pdf, "latin1"),
  };
}
