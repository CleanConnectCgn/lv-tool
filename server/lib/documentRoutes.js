// Block 8: Dokumentenausgabe - Endpoints, die die festen Renderer
// (server/lib/render/) anhand der ServiceSpec- bzw. Contract-Eingaben
// auslösen. Kein KI-Aufruf erzeugt hier Dokument- oder Vertragstext (Auftrag
// Block 8) - beide Renderer sind reiner, fester Code.
import { prisma } from './prisma.js';
import { renderLvPdf } from './render/lvPdf.js';
import { buildContractDocument } from './render/contractDocx.js';

const SPEC_ITEM_INCLUDE = { items: { include: { catalogItem: { include: { elementGroup: true } }, roomArea: true } } };
const SPEC_OBJECT_INCLUDE = { object: { include: { customer: true } } };

async function loadSpecsForPdf(specIds) {
  const specs = await prisma.serviceSpec.findMany({
    where: { id: { in: specIds } },
    include: { ...SPEC_ITEM_INCLUDE, ...SPEC_OBJECT_INCLUDE },
  });
  // Reihenfolge der angefragten IDs beibehalten, nicht die DB-Rückgabereihenfolge.
  return specIds.map((id) => specs.find((s) => s.id === id)).filter(Boolean);
}

// Zufällige VT-XXXX-Nummer (gleiches Format wie der bisherige, separate
// vertragsgenerator) mit Eindeutigkeits-Prüfung gegen bereits in DIESER
// Datenbank vorhandene Verträge. Bis Block 9 migriert ist, kennt dieses
// System die Nummern des alten Systems nicht - ein echter fortlaufender,
// system-übergreifender Zähler ist erst nach der Migration sinnvoll möglich.
async function generateUniqueVertragsnummer() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = `VT-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.document.findFirst({
      where: { type: 'VERTRAG', renderedData: { path: ['vertragsnummer'], equals: candidate } },
    });
    if (!existing) return candidate;
  }
  throw new Error('Konnte keine eindeutige Vertragsnummer erzeugen');
}

export function registerDocumentRoutes(app) {
  // Leistungsverzeichnis-PDF: ein oder mehrere ServiceSpecs, je einer ein
  // eigener Abschnitt mit Kopfzeile (Auftrag Block 8).
  app.get('/api/db/lv-pdf', async (req, res) => {
    const specIds = String(req.query.specIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (specIds.length === 0) return res.status(400).json({ error: 'specIds ist erforderlich' });
    try {
      const specs = await loadSpecsForPdf(specIds);
      if (specs.length === 0) return res.status(404).json({ error: 'Kein Leistungsverzeichnis gefunden' });
      const buffer = renderLvPdf(specs);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline; filename="Leistungsverzeichnis.pdf"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Leistungsverzeichnis-PDF konnte nicht erstellt werden' });
    }
  });

  // Vertrag erzeugen: legt Document (renderedData = die Eingabefelder, aus
  // denen gerendert wird) + Contract an. Das DOCX selbst wird nicht als
  // Binärdatei gespeichert, sondern bei Bedarf aus renderedData neu gerendert
  // (GET .../docx) - konsistent mit "das JSON, aus dem gerendert wurde"
  // (Auftrag Block 2, documents.rendered_data).
  app.post('/api/db/objects/:id/contract', async (req, res) => {
    try {
      const object = await prisma.property.findUnique({ where: { id: req.params.id }, include: { customer: true } });
      if (!object) return res.status(404).json({ error: 'Objekt nicht gefunden' });

      const vertragsnummer = req.body?.vertragsnummer || (await generateUniqueVertragsnummer());
      const objektAdresse = [object.street, [object.zip, object.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');

      const renderedData = {
        kunde: {
          firma: object.customer.name,
          strasse: object.customer.street,
          plz: object.customer.zip,
          ort: object.customer.city,
          ansprechpartner: object.customer.contactPerson,
        },
        objektAdresse,
        ueberschrift: req.body?.ueberschrift || 'Reinigungsvertrag',
        vertragsnummer,
        leistungsart: req.body?.leistungsart || 'Unterhaltsreinigung',
        reinigungsintervall: req.body?.reinigungsintervall || '',
        verguetungNetto: req.body?.verguetungNetto ?? null,
        mwstSatz: req.body?.mwstSatz ?? 19,
        zahlungszielWerktage: req.body?.zahlungszielWerktage ?? null,
        laufzeitMonate: req.body?.laufzeitMonate ?? null,
        kuendigungsfristMonate: req.body?.kuendigungsfristMonate ?? 2,
        vertragsbeginn: req.body?.vertragsbeginn || null,
        internerAnsprechpartner: req.body?.internerAnsprechpartner || '',
        optionalePositionen: Array.isArray(req.body?.optionalePositionen) ? req.body.optionalePositionen : [],
        dsgvoVariante: req.body?.dsgvoVariante || 'standard',
        angebotNummer: req.body?.angebotNummer || null,
        angebotDatum: req.body?.angebotDatum || null,
        lvDatum: req.body?.lvDatum || null,
        datum: new Date().toISOString().slice(0, 10),
      };

      const result = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            type: 'VERTRAG',
            customerId: object.customerId,
            renderedData,
            ownerId: req.user?.id || null,
          },
        });
        const contract = await tx.contract.create({
          data: { customerId: object.customerId, documentId: document.id, ownerId: req.user?.id || null },
        });
        return { document, contract };
      });

      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Vertrag konnte nicht angelegt werden' });
    }
  });

  app.get('/api/db/contracts', async (req, res) => {
    try {
      const where = req.query.customerId ? { customerId: req.query.customerId } : {};
      const rows = await prisma.contract.findMany({ where, include: { document: true }, orderBy: { createdAt: 'desc' } });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Verträge konnten nicht geladen werden' });
    }
  });

  app.get('/api/db/contracts/:id/docx', async (req, res) => {
    try {
      const contract = await prisma.contract.findUnique({ where: { id: req.params.id }, include: { document: true } });
      if (!contract) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      const buffer = await buildContractDocument(contract.document.renderedData);
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.set(
        'Content-Disposition',
        `attachment; filename="${contract.document.renderedData?.vertragsnummer || 'Vertrag'}.docx"`
      );
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Vertrag-DOCX konnte nicht erstellt werden' });
    }
  });
}
