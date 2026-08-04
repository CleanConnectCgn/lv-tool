// Gemeinsame, rein visuelle PDF-Bausteine für contractPdf.js/avvPdf.js -
// KEIN Vertragstext hier (der bleibt bewusst getrennt in den beiden
// Dateien, siehe Kopfkommentar dort). Farben/Optik an server/lib/render/
// lvPdf.js angelehnt (Wiedererkennbarkeit zwischen LV- und Vertrags-PDFs).
import { AUFTRAGNEHMER } from './contractFields.js';

export const TEAL = [0, 197, 196];
export const TEAL_DARK = [0, 127, 126];
export const INK = [17, 17, 17];
export const GRAY = [107, 114, 128];
export const LINE = [205, 210, 215];
export const SEC_BG = [240, 246, 246];
export const WARN_BG = [253, 236, 236];
export const WARN_TEXT = [180, 35, 24];

export const PAGE_W = 210;
export const MARGIN_X = 12;
export const CONTENT_W = PAGE_W - 2 * MARGIN_X;
export const MARGIN_TOP = 40;
export const MARGIN_BOTTOM = 30;

// --- Zeilen-Bausteine für die Fließtext-Tabelle (eine breite Spalte,
// jspdf-autotable übernimmt die Seitenumbrüche automatisch). ---
export function headingRow(num, title) {
  return [
    {
      content: `§${num} ${title}`,
      styles: {
        fontStyle: 'bold',
        fontSize: 11.5,
        textColor: INK,
        fillColor: false,
        cellPadding: { top: 6, bottom: 2, left: 0, right: 0 },
        lineWidth: { bottom: 0.4 },
        lineColor: TEAL,
      },
    },
  ];
}

export function clauseRow(num, text) {
  return [{ content: `${num}  ${text}`, styles: { fontSize: 9, cellPadding: { top: 1, bottom: 2.5 } } }];
}

export function paraRow(text) {
  return [{ content: text, styles: { fontSize: 9, cellPadding: { top: 1, bottom: 2.5 } } }];
}

export function bulletRow(text) {
  return [
    { content: `•  ${text}`, styles: { fontSize: 9, textColor: GRAY, cellPadding: { top: 0.5, bottom: 0.5, left: 4 } } },
  ];
}

export function boldRow(text) {
  return [{ content: text, styles: { fontStyle: 'bold', fontSize: 9.5, cellPadding: { top: 3, bottom: 1 } } }];
}

export function warnBannerRow(text) {
  return [
    {
      content: text,
      styles: { fontStyle: 'bold', fontSize: 8.5, fillColor: WARN_BG, textColor: WARN_TEXT, cellPadding: 3 },
    },
  ];
}

export function hinweisRow(text) {
  return [{ content: text, styles: { fontSize: 7.5, fontStyle: 'italic', textColor: GRAY, cellPadding: { top: 8, bottom: 2 } } }];
}

export function drawLetterhead(doc) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEAL_DARK);
  doc.text(AUFTRAGNEHMER.firma.toUpperCase(), MARGIN_X, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(
    `${AUFTRAGNEHMER.strasse} | ${AUFTRAGNEHMER.plz} ${AUFTRAGNEHMER.ort} | ${AUFTRAGNEHMER.telefon} | ${AUFTRAGNEHMER.email}`,
    MARGIN_X,
    16
  );
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, 19, PAGE_W - MARGIN_X, 19);
}

export function drawFurniture(doc) {
  const total = doc.internal.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${AUFTRAGNEHMER.firma} · ${AUFTRAGNEHMER.amtsgericht} · ${AUFTRAGNEHMER.hrNummer} · IBAN ${AUFTRAGNEHMER.iban} · USt.-ID ${AUFTRAGNEHMER.ustId} · GF ${AUFTRAGNEHMER.geschaeftsfuehrung}`,
      MARGIN_X,
      pageH - 6,
      { maxWidth: CONTENT_W - 20 }
    );
    doc.text(`Seite ${p} / ${total}`, PAGE_W - MARGIN_X, pageH - 6, { align: 'right' });
  }
}

// Bug gefunden 2026-07-31 (visuelle Prüfung): eine naive feste Boxhöhe
// überlappte mit der Rollen-Bezeichnung bzw. der Fußzeile, sobald ein Name
// zweizeilig umbrach. Zeilenzahl wird jetzt vorher mit splitTextToSize
// gemessen, Boxhöhe und Fußzeilen-Abstand richten sich danach.
// leftLabel/rightLabel: siehe docxHelpers.js signatureBlock() - Hauptvertrag
// "als Auftragnehmer"/"als Auftraggeber", AVV "Auftragsverarbeiter"/
// "Verantwortlicher" (ohne "als").
export function drawSignatureBlock(doc, kundeFirma, { leftLabel = 'als Auftragnehmer', rightLabel = 'als Auftraggeber' } = {}) {
  const colW = CONTENT_W / 2 - 4;
  const nameWidth = colW - 6;
  const lineH = 3.6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const leftName = `${AUFTRAGNEHMER.firma} · ${AUFTRAGNEHMER.geschaeftsfuehrung} (Geschäftsführer)`;
  const rightName = kundeFirma || '[Auftraggeber]';
  const leftLines = doc.splitTextToSize(leftName, nameWidth);
  const rightLines = doc.splitTextToSize(rightName, nameWidth);
  const nameLines = Math.max(leftLines.length, rightLines.length);
  // "Ort/Datum"(5) + Trennlinie(8) + Namenszeilen(n*lineH) + Rollen-Label(5)
  // + Innenabstand unten(3).
  const boxH = 13 + nameLines * lineH + 5 + 3;
  const bottomEdge = doc.internal.pageSize.getHeight() - 14;
  const y = bottomEdge - boxH;

  const cell = (x, title, lines) => {
    doc.setFillColor(...SEC_BG);
    doc.rect(x, y, colW, boxH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('Ort / Datum', x + 3, y + 5);
    doc.setDrawColor(205, 211, 215);
    doc.setLineWidth(0.2);
    doc.line(x + 3, y + 13, x + colW - 3, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    let ty = y + 17;
    for (const line of lines) {
      doc.text(line, x + 3, ty);
      ty += lineH;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(title, x + 3, ty + 0.5);
  };
  cell(MARGIN_X, leftLabel, leftLines);
  cell(MARGIN_X + colW + 8, rightLabel, rightLines);
}

// Bug gefunden 2026-07-31 (Kundenfeedback): jspdf-autotable bricht Seiten
// rein nach verfügbarem Platz um, ohne Rücksicht auf Sinnzusammenhänge - eine
// §-Überschrift (oder eine AVV-Unterüberschrift wie "Zutrittskontrolle")
// landete dadurch manchmal als letzte Zeile einer Seite, der zugehörige Text
// erst auf der nächsten. Erkennung rein über die Zeilen-Formatierung (fett -
// nutzen NUR heading()/boldRow(), nie clause()/bullet()/para()), kein
// Content-Pattern nötig. willDrawCell ist der von jspdf-autotable dafür
// vorgesehene Hook: erlaubt einen manuellen Seitenumbruch VOR dem Zeichnen
// einer Zeile, wenn nicht mehr genug Platz für die Überschrift plus
// mindestens eine Textzeile bleibt.
function avoidOrphanedHeadings(data) {
  if (data.section !== 'body') return;
  const isHeadingRow = data.row.raw?.[0]?.styles?.fontStyle === 'bold';
  if (!isHeadingRow) return;
  const pageH = data.doc.internal.pageSize.getHeight();
  const remaining = pageH - MARGIN_BOTTOM - data.cursor.y;
  const MIN_SPACE_FOR_HEADING_PLUS_LINE = 26;
  if (remaining < MIN_SPACE_FOR_HEADING_PLUS_LINE) {
    data.doc.addPage();
    data.cursor.y = MARGIN_TOP;
  }
}

export function buildAutoTableBody(doc, { startY, body }) {
  return {
    startY,
    body,
    theme: 'plain',
    margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_X, right: MARGIN_X },
    tableWidth: CONTENT_W,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: INK,
      overflow: 'linebreak',
      cellPadding: { top: 1, bottom: 1, left: 0, right: 0 },
    },
    columnStyles: { 0: { cellWidth: CONTENT_W } },
    willDrawCell: avoidOrphanedHeadings,
  };
}
