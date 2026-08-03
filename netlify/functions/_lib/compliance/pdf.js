// netlify/functions/_lib/compliance/pdf.js
//
// Génère le PDF du contrat signé : texte intégral (voir contracts.js) +
// image de la signature manuscrite + bloc de preuve (date, heure, IP,
// identifiant utilisateur, version du contrat) en pied de dernière page.
// Un seul appel, pas de mise en page complexe — priorité à un document
// lisible et fidèle au texte réellement accepté, pas à l'esthétique.

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_WIDTH = 595.28;  // A4 en points (72 dpi)
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapLine(line, font, size, maxWidth) {
  if (line.length === 0) return [''];
  const words = line.split(' ');
  const wrapped = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

// Génère le PDF et renvoie un Buffer. `proof` = { signedAt, ipAddress,
// userId, version, signatureImageBytes (PNG) }.
async function generateContractPdf({ title, contractText, proof }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(needed) {
    if (y - needed < MARGIN) newPage();
  }

  function drawParagraph(text, { bold = false, size = FONT_SIZE, spacingAfter = LINE_HEIGHT * 0.6 } = {}) {
    const useFont = bold ? fontBold : font;
    const rawLines = text.split('\n');
    for (const rawLine of rawLines) {
      const wrapped = wrapLine(rawLine, useFont, size, USABLE_WIDTH);
      for (const w of wrapped) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(w, { x: MARGIN, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
        y -= LINE_HEIGHT;
      }
    }
    y -= spacingAfter;
  }

  drawParagraph(title, { bold: true, size: 14, spacingAfter: LINE_HEIGHT });

  // Le texte du contrat est déjà découpé en paragraphes par des lignes
  // vides (\n\n) — chaque bloc est traité indépendamment pour garder une
  // mise en page lisible plutôt qu'un mur de texte.
  const blocks = contractText.split(/\n\n+/);
  for (const block of blocks) {
    const isHeading = /^ARTICLE \d+/.test(block.trim());
    drawParagraph(block.trim(), { bold: isHeading, spacingAfter: LINE_HEIGHT * (isHeading ? 0.4 : 0.9) });
  }

  // ── Bloc de preuve de signature (toujours en dernière page) ──
  ensureSpace(160);
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;

  drawParagraph('PREUVE DE SIGNATURE ÉLECTRONIQUE', { bold: true, size: 11, spacingAfter: 8 });
  drawParagraph(`Date et heure : ${new Date(proof.signedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (heure de Paris)`, { spacingAfter: 4 });
  drawParagraph(`Adresse IP : ${proof.ipAddress || 'non disponible'}`, { spacingAfter: 4 });
  drawParagraph(`Navigateur : ${proof.userAgent || 'non disponible'}`, { spacingAfter: 4 });
  drawParagraph(`Identifiant utilisateur : ${proof.userId}`, { spacingAfter: 4 });
  drawParagraph(`Version du contrat signée : ${proof.version}`, { spacingAfter: 4 });
  if (proof.signatureHash) {
    drawParagraph(`Empreinte de la signature (SHA-256) : ${proof.signatureHash}`, { spacingAfter: 12, size: 8 });
  }

  async function drawSignatureImage(bytes, label) {
    if (!bytes) return;
    try {
      const png = await doc.embedPng(bytes);
      const maxW = 220, maxH = 90;
      const scale = Math.min(maxW / png.width, maxH / png.height, 1);
      const w = png.width * scale, h = png.height * scale;
      ensureSpace(h + 24);
      page.drawText(label, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
      y -= h + 6;
      page.drawImage(png, { x: MARGIN, y, width: w, height: h });
      page.drawRectangle({ x: MARGIN, y, width: w, height: h, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
      y -= 18;
    } catch (e) {
      drawParagraph(`[${label} illisible — voir le fichier archivé séparément]`, {});
    }
  }

  await drawSignatureImage(proof.signatureImageBytes, 'Signature manuscrite électronique du signataire :');
  await drawSignatureImage(proof.companySignatureBytes, 'Signature officielle de Génération Capable :');

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

module.exports = { generateContractPdf };
