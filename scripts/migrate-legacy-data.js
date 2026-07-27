// Block 9: Einmalige Migration der bestehenden dateibasierten Dokumente
// (Freitext-LV) in das neue Postgres-Modell (Kunden/Objekte/ServiceSpec).
//
// Nimmt bewusst NICHT die alten Auftrag-Dateien oder eine Live-Verbindung
// zum Railway-Volume (kein SSH-Zugriff eingerichtet), sondern den bereits
// etablierten /api/backup-Export als Quelle - das ist exakt der Datenstand,
// den auch das reguläre Backup sichert, und lässt sich ohne Volume-Zugriff
// gegen jede Ziel-Datenbank (Testkopie ODER echte Produktion) fahren.
//
// Ablauf pro Kunde (Gruppierung über dieselbe customerKeyFor()-Logik wie im
// bestehenden dateibasierten CRM, siehe src/lib/crmKeys.js):
//   1. Customer anlegen/wiederverwenden (sevdeskContactId = altes customer.id,
//      falls vorhanden - stellt zugleich die Block-6-Verknüpfung her).
//   2. Je distinktem "objekt"-Adressstring ein Property anlegen/wiederverwenden.
//   3. Je Dokument ein ServiceSpec; je Zeile ein ServiceSpecItem - aber NUR,
//      wenn ALLE drei Bedingungen erfüllt sind: (a) Gemini liefert eine
//      tatsächlich existierende Katalog-ID, (b) eine tatsächlich existierende
//      Raumbereich-ID, (c) die Häufigkeit ist eindeutig (genau ein Intervall-
//      feld, numerisch parsbar - "Tägl." z.B. ist NICHT eindeutig genug).
//      Alles andere landet unverändert (Originaltext, Intervall, Bemerkung,
//      ggf. Modell-Hinweis) im "nicht zugeordnet"-Report statt geraten oder
//      verworfen zu werden - siehe MIGRATION.md.
//
// Nie das Modell selbst eine ID erfinden lassen: jede zurückgegebene
// catalogItemId/roomAreaId wird gegen die tatsächlich übergebene Liste
// geprüft, exakt wie in server/lib/extraction/index.js (Block 7) - dieses
// Skript ruft absichtlich NICHT den Block-7-Adapter auf (der ist für
// Bild/PDF-Uploads gebaut), sondern hat einen eigenen, schlanken Text-Prompt,
// damit Block 7 unangetastet bleibt.
//
// Aufruf:
//   DATABASE_URL=... GEMINI_API_KEY=... node scripts/migrate-legacy-data.js \
//     --source backup.json [--apply] [--report out.json]
// Ohne --apply: reiner Trockenlauf (nichts wird geschrieben), nur Report.

import fs from 'fs/promises';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { customerKeyFor } from '../src/lib/crmKeys.js';

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = { apply: false, source: null, report: null, noMatch: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--report') args.report = argv[++i];
    else if (argv[i] === '--no-match') args.noMatch = true;
  }
  return args;
}

function parseIntervalValue(v) {
  const m = /^(\d+)x$/i.exec((v || '').trim());
  return m ? Number(m[1]) : null;
}

// "Straße 1, 50667 Köln" -> { street, zip, city }. Scheitert absichtlich an
// Freitext ohne dieses Muster (z.B. "ohja events") statt etwas zu raten.
function parseObjektAddress(objekt) {
  const m = /^(.*),\s*(\d{4,5})\s+(.+)$/.exec((objekt || '').trim());
  if (!m) return null;
  return { street: m[1].trim(), zip: m[2].trim(), city: m[3].trim() };
}

function leistungsartFor(doc) {
  if (doc.lvTitle) {
    const stripped = doc.lvTitle.replace(/^Leistungsverzeichnis\s+/i, '').trim();
    if (stripped) return stripped;
  }
  if (doc.docType) return doc.docType.charAt(0).toUpperCase() + doc.docType.slice(1);
  return 'Unterhaltsreinigung';
}

function buildRowsForDoc(doc) {
  const rows = [];
  for (const section of doc.sections || []) {
    for (const row of section.rows || []) {
      const nachBedarf = row.bedarf === true || row.intervalColumn === 'aufAnfrage';
      let woechentlich = null;
      let monatlich = null;
      let jaehrlich = null;
      let intervalUnclear = false;
      if (!nachBedarf) {
        const value = parseIntervalValue(row.intervalValue);
        if (value === null) {
          intervalUnclear = true;
        } else if (row.intervalColumn === 'woechentlich') woechentlich = value;
        else if (row.intervalColumn === 'monatlich') monatlich = value;
        else if (row.intervalColumn === 'jaehrlich') jaehrlich = value;
        else intervalUnclear = true;
      }
      rows.push({
        sectionTitle: section.title,
        originalText: row.text,
        bemerkung: row.bemerkung || '',
        nachBedarf,
        woechentlich,
        monatlich,
        jaehrlich,
        intervalRaw: `${row.intervalColumn || ''} ${row.intervalValue || ''}`.trim(),
        intervalUnclear,
      });
    }
  }
  return rows;
}

function buildMatchPrompt(rows, catalog, roomAreas) {
  const catalogList = catalog
    .map((c) => `- ${c.id}: ${c.gegenstand} / ${c.verb}${c.zusatz ? ' / ' + c.zusatz : ''}${c.synonyme?.length ? ' (Synonyme: ' + c.synonyme.join(', ') + ')' : ''}`)
    .join('\n');
  const roomAreaList = roomAreas.map((r) => `- ${r.id}: ${r.name}`).join('\n');
  const rowList = rows.map((r, i) => `${i}. [${r.sectionTitle}] ${r.originalText}`).join('\n');

  return `Wir migrieren ein bestehendes, bereits ausformuliertes Leistungsverzeichnis (kein Foto/Scan, reiner Text) in eine neue Datenstruktur mit einem geschlossenen Leistungskatalog und festen Raumbereichen.

Ordne JEDE der folgenden Zeilen, soweit möglich, GENAU EINEM Katalogeintrag UND GENAU EINEM Raumbereich zu. Du darfst NIEMALS eine ID erfinden - verwende ausschließlich IDs aus den unten aufgeführten Listen. Wenn keine der Katalog-IDs eindeutig passt oder kein Raumbereich eindeutig passt, lass das jeweilige Feld auf null - rate nicht.

Geschlossener Katalog (nur diese IDs sind gültig):
${catalogList}

Raumbereiche (nur diese IDs sind gültig):
${roomAreaList}

Zeilen (Index. [Abschnittstitel] Text):
${rowList}

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen:
{
  "rows": [
    { "index": 0, "catalogItemId": "id oder null", "roomAreaId": "id oder null" }
  ]
}
Für jeden Index in der Liste oben genau ein Eintrag, in derselben Reihenfolge.`;
}

async function matchRowsWithGemini(rows, catalog, roomAreas, { noMatch = false } = {}) {
  if (rows.length === 0) return [];
  // --no-match: KI-Zuordnung bewusst überspringen (z.B. Tageskontingent
  // erschöpft) - alle Zeilen landen unverändert im "nicht zugeordnet"-Report
  // statt zu warten oder zu raten.
  if (noMatch) return rows.map((row) => ({ ...row, catalogItemId: null, roomAreaId: null }));
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY ist nicht konfiguriert');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const result = await model.generateContent(buildMatchPrompt(rows, catalog, roomAreas));
  const text = result?.response?.text() || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    throw new Error(`Antwort des Modells war kein gültiges JSON: ${err.message}`);
  }

  const validCatalogIds = new Set(catalog.map((c) => c.id));
  const validRoomAreaIds = new Set(roomAreas.map((r) => r.id));
  const byIndex = new Map((parsed.rows || []).map((r) => [r.index, r]));

  return rows.map((row, i) => {
    const hint = byIndex.get(i);
    const catalogItemId = hint?.catalogItemId && validCatalogIds.has(hint.catalogItemId) ? hint.catalogItemId : null;
    const roomAreaId = hint?.roomAreaId && validRoomAreaIds.has(hint.roomAreaId) ? hint.roomAreaId : null;
    return { ...row, catalogItemId, roomAreaId };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) throw new Error('--source <backup.json> ist erforderlich');

  const backup = JSON.parse(await fs.readFile(args.source, 'utf-8'));
  const documents = Object.entries(backup.files || {})
    .filter(([path]) => path.startsWith('documents/'))
    .map(([, doc]) => doc);

  console.log(`${documents.length} Dokumente aus ${args.source} geladen. Modus: ${args.apply ? 'APPLY (schreibt in DATABASE_URL)' : 'DRY-RUN (nur Report)'}`);

  const catalog = await prisma.serviceCatalogItem.findMany();
  const roomAreas = await prisma.roomArea.findMany();

  // Gruppieren wie im bestehenden dateibasierten CRM (server/index.js
  // GET /api/crm/customers): "neueste Version der Stammdaten gewinnt".
  const byCustomerKey = new Map();
  for (const doc of documents) {
    const key = customerKeyFor(doc.customer);
    if (!key) continue;
    if (!byCustomerKey.has(key)) byCustomerKey.set(key, { customer: doc.customer, docs: [] });
    const entry = byCustomerKey.get(key);
    entry.docs.push(doc);
    if (!entry.customer.updatedAt || doc.updatedAt > entry.customer.updatedAt) entry.customer = doc.customer;
  }

  const summary = { customersCreated: 0, objectsCreated: 0, specsCreated: 0, itemsCreated: 0 };
  const openItems = []; // "nicht zugeordnet"-Report
  const addressGaps = [];

  for (const [key, { customer, docs }] of byCustomerKey) {
    let customerRow = customer.id
      ? await prisma.customer.findUnique({ where: { sevdeskContactId: customer.id } })
      : await prisma.customer.findFirst({ where: { name: customer.name, sevdeskContactId: null } });

    if (!customerRow) {
      const data = {
        name: customer.name || 'Unbekannt',
        street: customer.street || null,
        zip: customer.zip || null,
        city: customer.city || null,
        sevdeskContactId: customer.id || null,
      };
      if (args.apply) customerRow = await prisma.customer.create({ data });
      else customerRow = { id: `dry-run-${key}`, ...data };
      summary.customersCreated++;
    }

    // Objekte: ein Objekt je distinktem "objekt"-Adressstring der Dokumente
    // dieses Kunden.
    const objectsByAddressKey = new Map();
    for (const doc of docs) {
      const addrKey = doc.objekt || `${customer.street}|${customer.zip}|${customer.city}`;
      if (objectsByAddressKey.has(addrKey)) continue;

      const parsed = parseObjektAddress(doc.objekt) || {
        street: customer.street || '',
        zip: customer.zip || '',
        city: customer.city || '',
      };
      if (!parsed.street && !parsed.zip && !parsed.city) {
        addressGaps.push({ customerKey: key, customerName: customer.name, objekt: doc.objekt, documentId: doc.id });
      }

      let objectRow = null;
      if (customerRow.id && !String(customerRow.id).startsWith('dry-run-')) {
        objectRow = await prisma.property.findFirst({ where: { customerId: customerRow.id, street: parsed.street } });
      }
      if (!objectRow) {
        const data = {
          customerId: customerRow.id,
          street: parsed.street,
          zip: parsed.zip,
          city: parsed.city,
          label: parsed.street || doc.objekt || customer.name,
        };
        if (args.apply) objectRow = await prisma.property.create({ data });
        else objectRow = { id: `dry-run-${key}-${objectsByAddressKey.size}`, ...data };
        summary.objectsCreated++;
      }
      objectsByAddressKey.set(addrKey, objectRow);
    }

    // ServiceSpecs: ein ServiceSpec je Dokument, unter dem passenden Objekt.
    for (const doc of docs) {
      const addrKey = doc.objekt || `${customer.street}|${customer.zip}|${customer.city}`;
      const objectRow = objectsByAddressKey.get(addrKey);
      const leistungsart = leistungsartFor(doc);
      const standDatum = doc.datum ? new Date(doc.datum) : new Date(doc.updatedAt || doc.createdAt);

      if (args.apply) {
        const existingSpec = await prisma.serviceSpec.findFirst({
          where: { objectId: objectRow.id, leistungsart, standDatum },
        });
        if (existingSpec) {
          console.log(`  übersprungen (bereits migriert): ${customer.name} / ${leistungsart} / ${standDatum.toISOString().slice(0, 10)}`);
          continue;
        }
      }

      const rows = buildRowsForDoc(doc);
      const matched = await matchRowsWithGemini(rows, catalog, roomAreas, { noMatch: args.noMatch });

      const itemsToCreate = [];
      for (const row of matched) {
        const intervalFieldsSet = [row.nachBedarf, row.woechentlich, row.monatlich, row.jaehrlich].filter(
          (v) => v === true || (typeof v === 'number' && !Number.isNaN(v))
        ).length;
        const isClean =
          !row.intervalUnclear && intervalFieldsSet === 1 && row.catalogItemId && row.roomAreaId;

        if (isClean) {
          itemsToCreate.push(row);
        } else {
          openItems.push({
            customerKey: key,
            customerName: customer.name,
            objectLabel: objectRow.label,
            documentId: doc.id,
            leistungsart,
            sectionTitle: row.sectionTitle,
            originalText: row.originalText,
            intervalRaw: row.nachBedarf ? 'nach Bedarf' : row.intervalRaw,
            bemerkung: row.bemerkung,
            modelHintCatalogItemId: row.catalogItemId,
            modelHintRoomAreaId: row.roomAreaId,
            reason: row.intervalUnclear
              ? 'Häufigkeit nicht eindeutig interpretierbar'
              : !row.catalogItemId
                ? 'kein passender Katalogeintrag'
                : 'kein passender Raumbereich',
          });
        }
      }

      if (itemsToCreate.length > 0) {
        if (args.apply) {
          await prisma.serviceSpec.create({
            data: {
              objectId: objectRow.id,
              leistungsart,
              standDatum,
              items: {
                create: itemsToCreate.map((row, i) => ({
                  catalogItemId: row.catalogItemId,
                  roomAreaId: row.roomAreaId,
                  nachBedarf: row.nachBedarf,
                  woechentlich: row.woechentlich,
                  monatlich: row.monatlich,
                  jaehrlich: row.jaehrlich,
                  bemerkung: row.bemerkung || null,
                  sortOrder: i,
                })),
              },
            },
          });
        }
        summary.specsCreated++;
        summary.itemsCreated += itemsToCreate.length;
      }
      console.log(
        `  ${customer.name} / ${leistungsart}: ${itemsToCreate.length}/${rows.length} Zeilen automatisch zugeordnet`
      );
    }
  }

  console.log('\n=== Zusammenfassung ===');
  console.log(summary);
  console.log(`Offene Punkte (nicht zugeordnet): ${openItems.length}`);
  console.log(`Adresslücken (Objekt ohne Straße/PLZ/Ort): ${addressGaps.length}`);

  if (args.report) {
    await fs.writeFile(args.report, JSON.stringify({ summary, openItems, addressGaps }, null, 2));
    console.log(`Report geschrieben nach ${args.report}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
