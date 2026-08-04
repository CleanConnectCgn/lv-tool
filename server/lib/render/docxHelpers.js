// Gemeinsame DOCX-Bausteine für die Dokumenten-Generatoren (Vertrag +
// AVV, contractDocx.js / avvDocx.js) - reines Layout, kein Vertragstext.
import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { AUFTRAGNEHMER } from './contractFields.js';

export const TEAL = '00C5C4';
export const GRAY = '6B7280';

export function heading(text, num) {
  return new Paragraph({
    children: [new TextRun({ text: `§${num} ${text}`, bold: true, size: 24 })],
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
  });
}

export function para(text) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 140 } });
}

export function clause(num, text) {
  return new Paragraph({
    children: [new TextRun({ text: `${num} `, bold: true }), new TextRun(text)],
    spacing: { after: 120 },
  });
}

export function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } });
}

export function formatEuro(value) {
  // Bug gefunden beim Rechts-Audit 2026-07-30: Number(null) und Number('')
  // sind 0, nicht NaN - eine fehlende Vergütung wurde dadurch fälschlich
  // als "0,00 EUR" ins Dokument geschrieben (ein erfundener, falscher
  // Geldbetrag) statt als erkennbarer Platzhalter. Echte 0 (z.B. bewusst
  // kostenlose Zusatzleistung) bleibt "0,00 EUR" - nur fehlende Werte
  // werden jetzt als "—" erkannt.
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

// MwSt.-Satz wurde vorher als rohe JS-Zahl interpoliert (`${satz} %`) - bei
// einem Nicht-Ganzzahl-Satz (z.B. 7,5 %) wäre das als "7.5 %" mit
// englischem Punkt statt deutschem Komma im Dokument gelandet. Gefunden
// beim Rechts-Audit 2026-07-30.
export function formatPercent(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function formatDateDE(iso) {
  if (!iso) return '[Datum]';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: none, bottom: none, left: none, right: none };
}

export function infoBoxRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 45, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [new Paragraph({ children: [new TextRun({ text: label, color: GRAY, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 55, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [new Paragraph({ children: [new TextRun({ text: value || '—', bold: true, size: 18 })] })],
      }),
    ],
  });
}

export function letterhead() {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: AUFTRAGNEHMER.firma.toUpperCase(), bold: true, size: 18 }),
        new TextRun({
          text: `\n${AUFTRAGNEHMER.strasse} | ${AUFTRAGNEHMER.plz} ${AUFTRAGNEHMER.ort} | ${AUFTRAGNEHMER.telefon} | ${AUFTRAGNEHMER.email}`,
          size: 16,
          color: GRAY,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 6 } },
      spacing: { after: 260 },
      children: [],
    }),
  ];
}

export function footerNote() {
  return new Paragraph({
    children: [
      new TextRun({
        text:
          `${AUFTRAGNEHMER.firma} · ${AUFTRAGNEHMER.amtsgericht} · ${AUFTRAGNEHMER.hrNummer} · ` +
          `IBAN ${AUFTRAGNEHMER.iban} · ${AUFTRAGNEHMER.bankinstitut} · BIC ${AUFTRAGNEHMER.bic} · ` +
          `USt.-ID ${AUFTRAGNEHMER.ustId} · GF ${AUFTRAGNEHMER.geschaeftsfuehrung}`,
        size: 14,
        color: GRAY,
      }),
    ],
  });
}

// leftLabel/rightLabel: Referenzvertrag VT-1265 nutzt im Hauptvertrag "als
// Auftragnehmer"/"als Auftraggeber", in der AVV dagegen "Auftragsverarbeiter"/
// "Verantwortlicher" (ohne "als") - beide Dokumente teilten sich vorher
// dieselben hartcodierten Auftragnehmer/Auftraggeber-Label, was für die AVV
// falsch war (Rechts-Audit 2026-07-31).
export function signatureBlock(kundeFirma, { leftLabel = 'als Auftragnehmer', rightLabel = 'als Auftraggeber' } = {}) {
  const cell = (title, name) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      shading: { fill: 'F5F8F8' },
      margin: { top: 150, bottom: 150, left: 150, right: 150 },
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Ort / Datum', size: 16, color: GRAY })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CDD3D7', space: 2 } },
          children: [],
        }),
        new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: title, size: 16, color: GRAY })] }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(leftLabel, `${AUFTRAGNEHMER.firma} · ${AUFTRAGNEHMER.geschaeftsfuehrung} (Geschäftsführer)`),
          cell(rightLabel, kundeFirma || '[Auftraggeber]'),
        ],
      }),
    ],
  });
}
