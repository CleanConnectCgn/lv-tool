// Block 8: Dokumentenausgabe - Endpoints, die die festen Renderer
// (server/lib/render/) anhand der ServiceSpec- bzw. Contract-Eingaben
// auslösen. Kein KI-Aufruf erzeugt hier Dokument- oder Vertragstext (Auftrag
// Block 8) - beide Renderer sind reiner, fester Code. Die einzige KI-Nutzung
// in dieser Datei ist die beratende Gegenkontrolle (POST .../ai-review), die
// selbst keinen Text in ein Dokument schreibt, sondern nur strukturiert
// Befunde zurückgibt (Baustein-System, siehe contractRules.js).
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma.js';
import { renderLvPdf } from './render/lvPdf.js';
import { buildContractDocument } from './render/contractDocx.js';
import { buildAvvDocument } from './render/avvDocx.js';
import { validateContract } from './render/contractRules.js';
import { withTimeout } from './withTimeout.js';
import {
  DSGVO_VARIANTEN,
  CONTRACT_TEMPLATE_VERSION,
  STANDARD_MWST,
  ZAHLUNGSZIEL_WERKTAGE,
} from './render/contractFields.js';

const SPEC_ITEM_INCLUDE = { items: { include: { catalogItem: { include: { elementGroup: true } }, roomArea: true } } };
const SPEC_OBJECT_INCLUDE = { object: { include: { customer: true } } };

// Gleiche Konfiguration wie der aiRateLimiter in server/index.js (dort nicht
// exportiert - lokale Instanz statt Kopplung an die dortige Modul-Reihenfolge).
const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele KI-Anfragen in kurzer Zeit. Bitte in ein paar Minuten erneut versuchen.' },
});

function extractJson(raw) {
  const jsonMatch = (raw || '').match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw || '{}');
}

async function loadSpecsForPdf(specIds) {
  const specs = await prisma.serviceSpec.findMany({
    where: { id: { in: specIds } },
    include: { ...SPEC_ITEM_INCLUDE, ...SPEC_OBJECT_INCLUDE },
  });
  // Reihenfolge der angefragten IDs beibehalten, nicht die DB-Rückgabereihenfolge.
  return specIds.map((id) => specs.find((s) => s.id === id)).filter(Boolean);
}

// Atomarer, fortlaufender Zähler (Sequence-Modell) statt "zufällig erzeugen +
// gegen die DB auf Eindeutigkeit prüfen" - ein einzelnes upsert mit
// { increment: 1 } ist eine atomare SQL-Anweisung, also race-condition-frei
// auch bei gleichzeitigen Anfragen. Nächste vergebene Nummer: VT-2001
// (bewusst über der höchsten bekannten realen Papier-Vertragsnummer, siehe
// VT-1264 im Referenzvertrag, um Kollisionen auszuschließen).
async function nextVertragsnummer() {
  const seq = await prisma.sequence.upsert({
    where: { name: 'vertragsnummer' },
    create: { name: 'vertragsnummer', value: 2001 },
    update: { value: { increment: 1 } },
  });
  return `VT-${seq.value}`;
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

      const objektAdresse = [object.street, [object.zip, object.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
      const dsgvoVariante = req.body?.dsgvoVariante || 'standard';

      const draftData = {
        kunde: {
          firma: object.customer.name,
          strasse: object.customer.street,
          plz: object.customer.zip,
          ort: object.customer.city,
          ansprechpartner: object.customer.contactPerson,
        },
        objektAdresse,
        ueberschrift: req.body?.ueberschrift || 'Reinigungsvertrag',
        leistungsart: req.body?.leistungsart || 'Unterhaltsreinigung',
        reinigungsintervall: req.body?.reinigungsintervall || '',
        verguetungNetto: req.body?.verguetungNetto ?? null,
        mwstSatz: req.body?.mwstSatz ?? STANDARD_MWST,
        // Bug gefunden 2026-07-29 beim Testen mit echten Kundendaten: wurde
        // hier als "?? null" gespeichert (Default sollte laut Kommentar erst
        // beim Rendern greifen), aber ein destructuring-Default in
        // contractDocx.js greift NUR bei undefined, nicht bei explizitem
        // null - das JSON aus der DB hat aber immer den Schlüssel gesetzt
        // (null statt fehlend). Ergebnis: "innerhalb von null Werktagen zu
        // leisten" im echten Vertrag. Deshalb jetzt wie kuendigungsfristMonate
        // sofort bei der Erstellung aufgelöst, nicht erst beim Rendern.
        zahlungszielWerktage: req.body?.zahlungszielWerktage ?? ZAHLUNGSZIEL_WERKTAGE,
        laufzeitMonate: req.body?.laufzeitMonate ?? null,
        kuendigungsfristMonate: req.body?.kuendigungsfristMonate ?? 2,
        vertragsbeginn: req.body?.vertragsbeginn || null,
        internerAnsprechpartner: req.body?.internerAnsprechpartner || '',
        optionalePositionen: Array.isArray(req.body?.optionalePositionen) ? req.body.optionalePositionen : [],
        dsgvoVariante,
        branche: req.body?.branche || null,
        angebotNummer: req.body?.angebotNummer || null,
        angebotDatum: req.body?.angebotDatum || null,
        lvDatum: req.body?.lvDatum || null,
        datum: new Date().toISOString().slice(0, 10),
      };

      // Vorgaben (contractRules.js): errors blockieren die Erstellung
      // (technisch unsinnige Eingaben), warnings nicht (Entwurf bleibt
      // möglich, tauchen aber im Response und als Banner im DOCX auf).
      const { errors, warnings } = validateContract(draftData);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Vertrag verstößt gegen feste Vorgaben', errors });
      }

      const vertragsnummer = req.body?.vertragsnummer || (await nextVertragsnummer());
      const renderedData = {
        ...draftData,
        vertragsnummer,
        // Snapshot des tatsächlich verwendeten Klauseltexts + Vorlagen-Version
        // (siehe contractDocx.js) - macht das Dokument unabhängig von
        // späteren Textänderungen an DSGVO_VARIANTEN.
        dsgvoKlausel: DSGVO_VARIANTEN[dsgvoVariante] || DSGVO_VARIANTEN.standard,
        contractTemplateVersion: CONTRACT_TEMPLATE_VERSION,
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

      res.status(201).json({ ...result, warnings });
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

  // AVV (Anlage 3) - nur für Datenschutz-Varianten mit braucht_avv: true.
  // Wird nicht separat gespeichert, sondern bei Bedarf aus denselben
  // renderedData gerendert wie der Hauptvertrag (kein neues DocumentType nötig).
  app.get('/api/db/contracts/:id/avv-docx', async (req, res) => {
    try {
      const contract = await prisma.contract.findUnique({ where: { id: req.params.id }, include: { document: true } });
      if (!contract) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      const dsgvoVariante = contract.document.renderedData?.dsgvoVariante || 'standard';
      const dsgvoInfo = DSGVO_VARIANTEN[dsgvoVariante];
      if (!dsgvoInfo || !dsgvoInfo.braucht_avv) {
        return res.status(409).json({ error: 'Für diese Datenschutz-Variante ist keine AVV erforderlich' });
      }
      const buffer = await buildAvvDocument(contract.document.renderedData);
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.set(
        'Content-Disposition',
        `attachment; filename="${contract.document.renderedData?.vertragsnummer || 'Vertrag'}-AVV.docx"`
      );
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'AVV-DOCX konnte nicht erstellt werden' });
    }
  });

  // Status-Historie (Entwurf -> versendet -> unterschrieben/gekündigt) - rein
  // manuell gepflegt, kein Auto-Trigger, siehe Plan "kein Status-Feld für
  // Vollständigkeit" (das prüft stattdessen validateContract bei jedem Rendern).
  app.patch('/api/db/contracts/:id/status', async (req, res) => {
    const { status } = req.body || {};
    const VALID = ['ENTWURF', 'VERSENDET', 'UNTERSCHRIEBEN', 'GEKUENDIGT'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ error: `status muss einer von ${VALID.join(', ')} sein` });
    }
    try {
      const data = { status };
      if (status === 'VERSENDET') data.sentAt = new Date();
      if (status === 'UNTERSCHRIEBEN') data.signedAt = new Date();
      const contract = await prisma.contract.update({ where: { id: req.params.id }, data });
      res.json(contract);
    } catch (err) {
      res.status(err?.code === 'P2025' ? 404 : 500).json({ error: err?.message || 'Status konnte nicht gesetzt werden' });
    }
  });

  // KI-Gegenkontrolle (beratend, kein Gate): prüft den bereits fertig
  // zusammengesetzten Vertrag gegen dieselben Vorgaben wie validateContract()
  // UND zusätzlich inhaltlich/im Kontext - schreibt selbst keinen
  // Vertragstext, sondern liefert nur strukturierte Befunde zurück. Nur
  // Claude (kein Gemini) wegen des knappen Gemini-Tageslimits (siehe
  // MIGRATION.md).
  app.post('/api/db/contracts/:id/ai-review', aiRateLimiter, async (req, res) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY ist nicht konfiguriert' });
    }
    try {
      const contract = await prisma.contract.findUnique({ where: { id: req.params.id }, include: { document: true } });
      if (!contract) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      const data = contract.document.renderedData;
      const { errors, warnings } = validateContract(data);

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const prompt = `Du bist ein erfahrener Qualitätsprüfer für gewerbliche Reinigungsverträge (Vertragsgenerator
"Baustein-System"). Prüfe den folgenden, bereits automatisiert zusammengesetzten Vertrag NICHT auf
allgemeine Rechtsfragen (das ist bereits durch feste Vorlagenklauseln und anwaltliche Prüfung
abgedeckt), sondern ausschließlich auf:
1. VERSTÖSSE gegen die unten aufgeführten Vorgaben (Vorgaben-Verletzungen)
2. WIDERSPRÜCHE innerhalb der Eingabedaten (z.B. Preis/Intervall/Laufzeit widersprechen sich,
   Anlage-Verweise im Text ohne zugehörige reale Anlage)
3. LÜCKEN, die noch nicht durch die Vorgaben-Prüfung erfasst sind

Bereits automatisch erkannte Vorgaben-Verstöße (errors, blockieren normalerweise die Erstellung):
${JSON.stringify(errors)}

Bereits automatisch erkannte Hinweise (warnings, blockieren nicht):
${JSON.stringify(warnings)}

Vertragsdaten (renderedData, daraus wird das DOCX gerendert):
${JSON.stringify(data, null, 2)}

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen:
{
  "verstoesse": [{"regel": "...", "fundstelle": "...", "begruendung": "..."}],
  "freigabe": "bereit",
  "begruendung": "..."
}
Für "freigabe" gilt ausschließlich "bereit" oder "ueberarbeitung".`;

      // Vorher kein Timeout (gefunden 2026-07-31 beim Prüfen aller
      // KI-Checkups) - ein hängender Claude-Aufruf hätte den "KI-Prüfung
      // starten"-Button unbegrenzt blockiert.
      const response = await withTimeout(
        client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
        60000,
        'Claude'
      );
      const textBlock = response?.content?.find((b) => b.type === 'text');
      const parsed = extractJson(textBlock?.text || '{}');

      const updated = await prisma.contract.update({
        where: { id: req.params.id },
        data: {
          lastAiReviewAt: new Date(),
          lastAiReviewFreigabe: parsed.freigabe || null,
          lastAiReviewResult: parsed,
        },
      });

      res.json({ ...parsed, vorgaben: { errors, warnings }, lastAiReviewAt: updated.lastAiReviewAt });
    } catch (err) {
      console.error('[contracts/ai-review] fehlgeschlagen:', err?.message || err);
      res.status(502).json({ error: err?.message || err?.toString() || 'KI-Prüfung fehlgeschlagen' });
    }
  });
}
