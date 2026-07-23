// Erzeugt das Leistungsverzeichnis-PDF regelbasiert mit jsPDF + autoTable.
//
// Bewusst NICHT mehr via html2canvas/html2pdf: Screenshots ergaben
// uneinheitliche, sich überschneidende Spalten und verschobene Layouts.
// autoTable rendert eine echte Tabelle mit festen Spaltenbreiten, wiederholt
// den Spaltenkopf auf JEDER Seite (nicht pro Bereich), bricht Bereiche sauber
// um und hält Zeilen zusammen.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Markenfarben (RGB)
const TEAL = [0, 197, 196];
const TEAL_DARK = [0, 127, 126];
const TEAL_BG = [224, 247, 247];
const INK = [17, 17, 17];
const GRAY = [107, 114, 128];
const LINE = [205, 210, 215];
const SEC_BG = [240, 246, 246];

// Seitengeometrie (A4, mm)
const PAGE_W = 210;
const MARGIN_X = 12;
const CONTENT_W = PAGE_W - 2 * MARGIN_X; // 186
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 30;

// Spaltenbreiten (Summe = 186)
const COL_W = { desc: 56, check: 22, woe: 24, mon: 22, jah: 20, bem: 42 };

// Firmenangaben für die Fußzeile - identisch zu unseren sevDesk-Angeboten.
const FOOTER_COLS = [
  ['Clean Connect Gebäudereinigung UG', 'Berliner Straße 957', '51069 Köln', 'Deutschland'],
  ['Tel. +49 221 95490625', 'E-Mail service@reinigungsdienst-', 'cleanconnect.de', 'Web www.cleanconnect.de'],
  ['Amtsgericht Köln', 'HR-Nr. HRB 119725', 'USt.-ID DE369309039', 'Steuer-Nr. 218/5706/1994', 'Geschäftsführung Fynn Laubkermeier'],
  ['Bank Sparkasse KölnBonn', 'Konto 1901211506', 'BLZ 37050198', 'IBAN DE79 3705 0198 1901 2115 06', 'BIC COLSDE33XXX'],
];

function formatDatum(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

// Kopfblock eines Dokuments (Kicker, Titel, Objekt/Intervalle/Stand).
// Gibt die Y-Position zurück, an der die Tabelle beginnen soll.
function drawDocHeader(doc, { lvTitle, objekt, datum }, y0) {
  const left = MARGIN_X;
  const right = PAGE_W - MARGIN_X;
  const h = 32;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(left, y0, CONTENT_W, h, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...TEAL_DARK);
  doc.text('CLEAN CONNECT GEBÄUDEREINIGUNG', left + 5, y0 + 8);

  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(lvTitle || 'Leistungsverzeichnis', left + 5, y0 + 16.5);

  // Trennlinie zwischen Titel- und Meta-Zeile
  const metaY = y0 + 21;
  doc.setDrawColor(...LINE);
  doc.line(left, metaY, right, metaY);
  // vertikale Trenner der drei Meta-Zellen
  const c1 = left + 62;
  const c2 = left + 124;
  doc.line(c1, metaY, c1, y0 + h);
  doc.line(c2, metaY, c2, y0 + h);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  doc.text('OBJEKT', left + 5, metaY + 4.5);
  doc.text('REINIGUNG INTERVALLE', (c1 + c2) / 2, metaY + 4.5, { align: 'center' });
  doc.text('STAND', right - 5, metaY + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(objekt || '', left + 5, metaY + 9);
  doc.text(formatDatum(datum), right - 5, metaY + 9, { align: 'right' });

  return y0 + h + 4;
}

const HEAD = [['Einzelleistungen Reinigung', 'Bei Bedarf', 'Wöchentlich', 'Monatlich', 'Jährlich', 'Bemerkungen']];

function intervalCell(row, col) {
  return { content: '', pill: true, value: row.intervalColumn === col ? row.intervalValue || '' : '' };
}

function buildBody(sections) {
  const body = [];
  (sections || []).forEach((section) => {
    const rows = (section.rows || []).filter((r) => (r.text || '').trim());
    if (rows.length === 0) return;
    body.push([
      {
        content: section.title || '',
        colSpan: 6,
        isSection: true,
        styles: {
          fillColor: SEC_BG,
          textColor: TEAL_DARK,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          cellPadding: { top: 2.4, bottom: 2.4, left: 5, right: 2.5 },
        },
      },
    ]);
    rows.forEach((r) => {
      const check = { content: '', checkCell: true, checked: !!r.bedarf };
      const bem = r.bemerkung || '';
      if (r.intervalColumn === 'aufAnfrage') {
        body.push([
          r.text,
          check,
          { content: '', colSpan: 3, pill: true, value: 'Auf Anfrage' },
          bem,
        ]);
      } else {
        body.push([
          r.text,
          check,
          intervalCell(r, 'woechentlich'),
          intervalCell(r, 'monatlich'),
          intervalCell(r, 'jaehrlich'),
          bem,
        ]);
      }
    });
  });
  return body;
}

// Zeichnet Häkchen-Boxen und Intervall-Pillen (nach dem Zellenhintergrund,
// damit nichts überdeckt wird).
function didDrawCell(doc, data) {
  if (data.section !== 'body') return;
  const raw = data.cell.raw;
  if (!raw || typeof raw !== 'object') return;
  const cx = data.cell.x + data.cell.width / 2;
  const cy = data.cell.y + data.cell.height / 2;

  if (raw.checkCell) {
    const s = 4.5;
    const x = cx - s / 2;
    const y = cy - s / 2;
    doc.setLineWidth(0.35);
    if (raw.checked) {
      doc.setFillColor(...TEAL);
      doc.setDrawColor(...TEAL);
      doc.roundedRect(x, y, s, s, 1, 1, 'FD');
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(x + 1.0, y + 2.4, x + 1.9, y + 3.3);
      doc.line(x + 1.9, y + 3.3, x + 3.6, y + 1.2);
    } else {
      doc.setDrawColor(150, 205, 205);
      doc.roundedRect(x, y, s, s, 1, 1, 'S');
    }
    return;
  }

  if (raw.pill) {
    const txt = String(raw.value || '').trim();
    if (!txt) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const tw = doc.getTextWidth(txt) + 6;
    const h = 5;
    doc.setFillColor(...TEAL_BG);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.2);
    doc.roundedRect(cx - tw / 2, cy - h / 2, tw, h, 2.5, 2.5, 'FD');
    doc.setTextColor(...TEAL_DARK);
    doc.text(txt, cx, cy, { align: 'center', baseline: 'middle' });
    return;
  }

  if (raw.isSection) {
    doc.setFillColor(...TEAL);
    doc.rect(data.cell.x, data.cell.y, 1.4, data.cell.height, 'F');
  }
}

// Markenzeile oben + vollständige Firmenfußzeile + Seitenzahl auf JEDER Seite.
function drawFurniture(doc) {
  const total = doc.internal.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  const colX = [12, 62, 114, 160];
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Clean Connect Gebäudereinigung · Berliner Straße 957 · 51069 Köln', 12, 8);
    doc.text(`Seite ${p} / ${total}`, PAGE_W - 12, 8, { align: 'right' });

    const footTop = pageH - 24;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(12, footTop, PAGE_W - 12, footTop);
    doc.setFontSize(6.3);
    doc.setTextColor(120, 120, 120);
    FOOTER_COLS.forEach((lines, ci) => {
      let y = footTop + 4;
      lines.forEach((ln) => {
        doc.text(ln, colX[ci], y);
        y += 2.7;
      });
    });
  }
}

// docs: [{ lvTitle, sections }] - Hauptdokument + verknüpfte LVs.
export function generateLvPdfBlob(docs, { objekt, datum }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const list = docs && docs.length ? docs : [{ lvTitle: 'Leistungsverzeichnis', sections: [] }];

  list.forEach((d, idx) => {
    if (idx > 0) doc.addPage();
    const startY = drawDocHeader(doc, { lvTitle: d.lvTitle, objekt, datum }, MARGIN_TOP);
    autoTable(doc, {
      startY,
      head: HEAD,
      body: buildBody(d.sections),
      theme: 'grid',
      margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_X, right: MARGIN_X },
      tableWidth: CONTENT_W,
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.1,
        overflow: 'linebreak',
        valign: 'middle',
        cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
      },
      headStyles: {
        fillColor: TEAL_BG,
        textColor: TEAL_DARK,
        fontStyle: 'bold',
        fontSize: 7.5,
        lineColor: TEAL,
        lineWidth: { bottom: 0.4, top: 0.1, left: 0.1, right: 0.1 },
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: COL_W.desc },
        1: { halign: 'center', cellWidth: COL_W.check },
        2: { halign: 'center', cellWidth: COL_W.woe },
        3: { halign: 'center', cellWidth: COL_W.mon },
        4: { halign: 'center', cellWidth: COL_W.jah },
        5: { halign: 'left', cellWidth: COL_W.bem, textColor: GRAY, fontSize: 8 },
      },
      didDrawCell: (data) => didDrawCell(doc, data),
    });
  });

  drawFurniture(doc);
  return doc.output('blob');
}
