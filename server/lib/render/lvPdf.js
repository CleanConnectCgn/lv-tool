// Block 8: Leistungsverzeichnis-PDF gegen das neue ServiceSpec-Modell
// (Block 2/5). Rahmen und Layout liegen fest im Code - variabel sind nur
// die eingesetzten Felder. Farben/Fontwahl an src/lib/lvPdfExport.js
// angelehnt (bestehende Markenoptik, schwarz-auf-weiß mit CC-Briefkopf).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TEAL = [0, 197, 196];
const TEAL_DARK = [0, 127, 126];
const TEAL_BG = [224, 247, 247];
const INK = [17, 17, 17];
const GRAY = [107, 114, 128];
const LINE = [205, 210, 215];
const SEC_BG = [240, 246, 246];

const PAGE_W = 210;
const MARGIN_X = 12;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 30;
const COL_W = { desc: 56, check: 22, woe: 24, mon: 22, jah: 20, bem: 42 };

// Geschlossene Verbliste (Auftrag Block 2) -> lesbarer deutscher Text für
// das gedruckte Dokument. Bewusst wörtlich aus dem Auftragstext übernommen,
// keine eigene Umformulierung.
const VERB_LABELS = {
  ENTSTAUBEN: 'entstauben',
  ABSAUGEN: 'absaugen',
  FEUCHT_WISCHEN: 'feucht wischen',
  NASS_WISCHEN: 'nass wischen',
  FEUCHT_REINIGEN: 'feucht reinigen',
  DESINFIZIEREND_REINIGEN: 'desinfizierend reinigen',
  FLECKENFREI_REINIGEN: 'fleckenfrei reinigen',
  GRIFFSPUREN_ENTFERNEN: 'Griffspuren entfernen',
  ENTLEEREN_UND_ENTSORGEN: 'entleeren und entsorgen',
  ENTKALKEN: 'entkalken',
};

// "Der angezeigte Leistungstext wird aus Gegenstand, Verb und Zusatz
// zusammengesetzt, nicht frei eingegeben" (Auftrag Block 2).
export function catalogItemDisplayText(catalogItem) {
  const verb = VERB_LABELS[catalogItem.verb] || catalogItem.verb;
  const zusatz = catalogItem.zusatz ? ` (${catalogItem.zusatz})` : '';
  return `${catalogItem.gegenstand} ${verb}${zusatz}`;
}

function formatDatum(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function addressLine(obj) {
  return [obj.street, [obj.zip, obj.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// Gruppiert Items nach Raumbereich (nach dessen sortOrder), darin nach
// Elementgruppe in fester Reihenfolge (Elementgruppen wurden mit genau
// dieser Reihenfolge geseedet: Boden, Wand, Abfall, Inventar - sortOrder
// 0-3, siehe prisma/seed.js). "Gemeinsame Positionen erscheinen einmal":
// Duplikate INNERHALB dieses einen Abschnitts (identischer Katalogeintrag +
// Raumbereich + Intervall + Bemerkung) werden auf eine Zeile reduziert.
export function groupItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = [
      item.catalogItemId,
      item.roomAreaId,
      item.nachBedarf,
      item.einmalig,
      item.woechentlich,
      item.monatlich,
      item.jaehrlich,
      item.bemerkung,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const byRoomArea = new Map();
  for (const item of deduped) {
    const ra = item.roomArea;
    if (!byRoomArea.has(ra.id)) byRoomArea.set(ra.id, { roomArea: ra, items: [] });
    byRoomArea.get(ra.id).items.push(item);
  }
  const roomAreaGroups = [...byRoomArea.values()].sort((a, b) => a.roomArea.sortOrder - b.roomArea.sortOrder);

  for (const group of roomAreaGroups) {
    group.items.sort((a, b) => {
      const eg = (a.catalogItem.elementGroup?.sortOrder ?? 0) - (b.catalogItem.elementGroup?.sortOrder ?? 0);
      if (eg !== 0) return eg;
      return catalogItemDisplayText(a.catalogItem).localeCompare(catalogItemDisplayText(b.catalogItem));
    });
  }
  return roomAreaGroups;
}

function drawDocHeader(doc, { leistungsart, kunde, objektAnschrift, standDatum }, y0) {
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
  doc.text(`Leistungsverzeichnis ${leistungsart}`, left + 5, y0 + 16.5);

  const metaY = y0 + 21;
  doc.setDrawColor(...LINE);
  doc.line(left, metaY, right, metaY);
  const c1 = left + 62;
  const c2 = left + 124;
  doc.line(c1, metaY, c1, y0 + h);
  doc.line(c2, metaY, c2, y0 + h);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  doc.text('KUNDE', left + 5, metaY + 4.5);
  doc.text('OBJEKTANSCHRIFT', (c1 + c2) / 2, metaY + 4.5, { align: 'center' });
  doc.text('STAND', right - 5, metaY + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(kunde || '', left + 5, metaY + 9);
  doc.text(objektAnschrift || '', (c1 + c2) / 2, metaY + 9, { align: 'center', maxWidth: c2 - c1 - 4 });
  doc.text(formatDatum(standDatum), right - 5, metaY + 9, { align: 'right' });

  return y0 + h + 4;
}

const HEAD = [['Einzelleistung', 'Bei Bedarf', 'Wöchentlich', 'Monatlich', 'Jährlich', 'Bemerkungen']];

function intervalValue(item, column) {
  if (column === 'woechentlich') return item.woechentlich ? `${item.woechentlich}x` : '';
  if (column === 'monatlich') return item.monatlich ? `${item.monatlich}x` : '';
  if (column === 'jaehrlich') return item.jaehrlich ? `${item.jaehrlich}x` : '';
  return '';
}

function buildBody(roomAreaGroups) {
  const body = [];
  for (const group of roomAreaGroups) {
    body.push([
      {
        content: group.roomArea.name,
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
    for (const item of group.items) {
      const check = { content: '', checkCell: true, checked: !!item.nachBedarf };
      if (item.einmalig) {
        // Echte einmalige Leistung (kein Wiederholungsintervall) - Merge
        // über alle drei Intervallspalten statt einer einzelnen, damit die
        // Pille nicht fälschlich unter "Wöchentlich"/"Monatlich"/"Jährlich"
        // zu stehen scheint. Gleicher Trick wie "Auf Anfrage" in
        // src/lib/lvPdfExport.js.
        body.push([
          catalogItemDisplayText(item.catalogItem),
          check,
          { content: '', colSpan: 3, pill: true, value: 'Einmalig' },
          item.bemerkung || '',
        ]);
      } else {
        body.push([
          catalogItemDisplayText(item.catalogItem),
          check,
          { content: '', pill: true, value: intervalValue(item, 'woechentlich') },
          { content: '', pill: true, value: intervalValue(item, 'monatlich') },
          { content: '', pill: true, value: intervalValue(item, 'jaehrlich') },
          item.bemerkung || '',
        ]);
      }
    }
  }
  return body;
}

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

function drawFurniture(doc) {
  const total = doc.internal.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Clean Connect Gebäudereinigung · Berliner Straße 957 · 51069 Köln', MARGIN_X, 8);
    doc.text(`Seite ${p} / ${total}`, PAGE_W - MARGIN_X, 8, { align: 'right' });
    const footTop = pageH - 10;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, footTop, PAGE_W - MARGIN_X, footTop);
  }
}

// specs: [{ leistungsart, standDatum, items: [...], object: { street, zip, city, customer: { name } } }]
// Jeder Spec-Eintrag bekommt einen eigenen Abschnitt mit eigener Kopfzeile
// (Auftrag Block 8) - egal ob die Specs von verschiedenen Objekten oder vom
// selben Objekt mit unterschiedlicher Leistungsart stammen.
export function renderLvPdf(specs) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const list = specs && specs.length ? specs : [];

  list.forEach((spec, idx) => {
    if (idx > 0) doc.addPage();
    const startY = drawDocHeader(
      doc,
      {
        leistungsart: spec.leistungsart,
        kunde: spec.object.customer.name,
        objektAnschrift: addressLine(spec.object),
        standDatum: spec.standDatum,
      },
      MARGIN_TOP
    );
    const roomAreaGroups = groupItems(spec.items);
    autoTable(doc, {
      startY,
      head: HEAD,
      body: buildBody(roomAreaGroups),
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
  return Buffer.from(doc.output('arraybuffer'));
}
