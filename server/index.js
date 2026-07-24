import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Railway terminiert TLS und leitet intern per HTTP weiter. Ohne trust proxy
// meldet req.protocol fälschlich "http", wodurch die an Google gesendete
// OAuth-Redirect-URI nicht mit der registrierten https://-URI übereinstimmt
// (Fehler "redirect_uri_mismatch").
app.set('trust proxy', true);

// Where saved LV/Angebot documents are stored. On Railway this needs a
// Volume mounted at this path, otherwise the directory is wiped on every
// redeploy (the container filesystem is ephemeral).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');
const LV_PDFS_DIR = path.join(DATA_DIR, 'Leistungsverzeichnisse');
const CRM_DIR = path.join(DATA_DIR, 'crm');
const CUSTOMERS_DIR = path.join(CRM_DIR, 'customers');
const AUFTRAEGE_DIR = path.join(CRM_DIR, 'auftraege');
const CALENDAR_TOKEN_FILE = path.join(CRM_DIR, 'calendar-token.json');

// Optionaler Basic-Auth-Schutz: nur aktiv, wenn APP_USERNAME/APP_PASSWORD
// gesetzt sind. Ohne diese Variablen bleibt das Verhalten unverändert
// (offen), damit bestehende Deployments nicht versehentlich ausgesperrt
// werden - Zugangsdaten müssen bewusst per `railway variables --set` gesetzt
// werden.
function basicAuthMiddleware(req, res, next) {
  const user = process.env.APP_USERNAME;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [reqUser, reqPass] = Buffer.from(encoded, 'base64').toString('utf-8').split(':');
    if (reqUser === user && reqPass === pass) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="LV-Tool"');
  res.status(401).send('Zugang erforderlich');
}

app.use(basicAuthMiddleware);
app.use(express.json({ limit: '5mb' }));

// Lets the frontend pre-fill the sevDesk token field so the user doesn't
// have to type it in manually when a server-side default is configured.
app.get('/api/sevdesk/token', (req, res) => {
  res.json({ token: process.env.SEVDESK_TOKEN || '' });
});

function extractSevDeskError(responseBody) {
  if (!responseBody) return 'Unbekannter Fehler';
  if (typeof responseBody === 'string') return responseBody;
  return (
    responseBody?.error?.message ||
    (typeof responseBody?.error === 'string' ? responseBody.error : null) ||
    responseBody?.message ||
    JSON.stringify(responseBody)
  );
}

// Generic proxy to the sevDesk API to avoid CORS issues from the browser.
// Body: { token, method, path, body } where path is relative, e.g. "/Contact" or "/Offer".
// Nur lesende und hinzufügende sevDesk-Aufrufe sind erlaubt (GET/POST). Das
// Tool darf in sevDesk niemals Dokumente ändern oder löschen können - PUT/
// PATCH/DELETE werden serverseitig hart abgelehnt, unabhängig davon, was das
// Frontend anfragt.
const SEVDESK_ALLOWED_METHODS = new Set(['GET', 'POST']);

app.post('/api/sevdesk/request', async (req, res) => {
  const { method = 'GET', path: sevPath, body } = req.body || {};
  const token = req.body?.token || process.env.SEVDESK_TOKEN;
  if (!token || !sevPath) {
    return res.status(400).json({ error: 'token und path sind erforderlich' });
  }
  if (!SEVDESK_ALLOWED_METHODS.has(String(method).toUpperCase())) {
    return res.status(403).json({ error: `Methode ${method} ist für sevDesk-Zugriffe nicht erlaubt (nur GET/POST).` });
  }
  try {
    const sevRes = await fetch(`https://my.sevdesk.de/api/v1${sevPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body || {}),
    });
    const data = await sevRes.json().catch(() => ({}));
    if (!sevRes.ok) {
      return res.status(sevRes.status).json({ error: extractSevDeskError(data) });
    }
    res.status(sevRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || err?.toString() || 'sevDesk Anfrage fehlgeschlagen' });
  }
});

// Form-encoded proxy for the sevDesk Factory endpoints, which expect
// application/x-www-form-urlencoded bodies instead of JSON.
// Body: { token, path, params } where params is a nested object that gets
// flattened into bracket-notation form fields, e.g. order[header]=Foo.
app.post('/api/sevdesk/form-request', async (req, res) => {
  const { token, path: sevPath, params } = req.body || {};
  const useToken = token || process.env.SEVDESK_TOKEN;
  if (!useToken || !sevPath) return res.status(400).json({ error: 'token und path erforderlich' });
  try {
    const formBody = new URLSearchParams(flattenToForm(params)).toString();
    const sevRes = await fetch(`https://my.sevdesk.de/api/v1${sevPath}`, {
      method: 'POST',
      headers: { Authorization: useToken, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    const data = await sevRes.json().catch(() => ({}));
    if (!sevRes.ok) return res.status(sevRes.status).json({ error: extractSevDeskError(data) });
    res.status(sevRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || 'Fehler' });
  }
});

function flattenToForm(obj, prefix = '') {
  const parts = [];
  function flatten(val, key) {
    if (val === null || val === undefined) {
      parts.push([key, 'null']);
    } else if (typeof val === 'boolean') {
      parts.push([key, val ? 'true' : 'false']);
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => flatten(item, `${key}[${i}]`));
    } else if (typeof val === 'object') {
      Object.entries(val).forEach(([k, v]) => flatten(v, `${key}[${k}]`));
    } else {
      parts.push([key, String(val)]);
    }
  }
  Object.entries(obj).forEach(([k, v]) => flatten(v, prefix ? `${prefix}[${k}]` : k));
  return Object.fromEntries(parts);
}

// Downloads the sevDesk PDF for a given offer (stored internally as an
// /Order document with orderType "AN" — sevDesk has no separate "Offer"
// resource, despite the endpoint name below).
app.get('/api/sevdesk/offer-pdf/:id', async (req, res) => {
  const token = process.env.SEVDESK_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'SEVDESK_TOKEN ist nicht konfiguriert' });
  }
  try {
    const sevRes = await fetch(`https://my.sevdesk.de/api/v1/Order/${req.params.id}/getPdf?download=1`, {
      headers: { Authorization: token },
    });
    if (!sevRes.ok) {
      const data = await sevRes.json().catch(() => ({}));
      return res.status(sevRes.status).json({ error: extractSevDeskError(data) || 'PDF nicht verfügbar' });
    }
    const buffer = Buffer.from(await sevRes.arrayBuffer());
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="Angebot.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ error: err?.message || err?.toString() || 'PDF Anfrage fehlgeschlagen' });
  }
});

// AI quality checkup for the LV: sends the sections to Claude and returns
// structured feedback (duplicates, typos, missing tasks, wording).
app.post('/api/ai-check', async (req, res) => {
  const { sections } = req.body || {};
  if (!sections) {
    return res.status(400).json({ error: 'sections sind erforderlich' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY ist nicht konfiguriert' });
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `Du bist ein Experte für Gebäudereinigung und Leistungsverzeichnisse. Analysiere dieses LV und gib strukturiertes Feedback in JSON zurück.

LV Daten:
${JSON.stringify(sections, null, 2)}

Gib AUSSCHLIESSLICH valides JSON zurück, kein Markdown, keine Erklärungen:
{
  "issues": [
    {
      "id": "unique id",
      "type": "red" oder "orange",
      "title": "Kurzer Titel",
      "description": "Erklärung was das Problem ist",
      "targetSection": "Bereichsname oder null",
      "targetRowIndex": Zeilennummer oder null,
      "fix": "Der verbesserte Text der direkt eingesetzt werden kann, oder null wenn nicht anwendbar",
      "fixType": "replace_row" oder "remove_row" oder "rename_section" oder "info"
    }
  ]
}

Rot Kategorien (type: "red"):
Duplikate: gleiche oder sehr ähnliche Leistung im selben Bereich, zum Beispiel zweimal Böden wischen.
Rechtschreibfehler oder offensichtliche Tippfehler.
Widersprüche: zum Beispiel täglich und wöchentlich für identische Leistung.

Orange Kategorien (type: "orange"):
Unklare Formulierungen die beim Kunden Fragen aufwerfen könnten.
Fehlende wichtige Leistungen die typischerweise in diesem Bereich erwartet werden.
Verbesserungsvorschläge für professionellere Sprache.
Intervalle die unüblich sind für diese Art Leistung.

Sei präzise und praxisnah. Max 15 Issues. Nur echte Probleme melden, keine Phantomfehler.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response?.content?.find((b) => b.type === 'text');
    const raw = textBlock?.text || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    res.json(parsed);
  } catch (err) {
    res.status(502).json({ error: err?.message || err?.toString() || 'KI Anfrage fehlgeschlagen' });
  }
});

// Races a promise against a timeout so a hanging AI provider can't block
// the checkup flow forever.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} hat nicht innerhalb von ${ms / 1000}s geantwortet`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function extractJson(raw) {
  const jsonMatch = (raw || '').match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw || '{}');
}

// Dual AI checkup, step 1: Gemini analyzes the LV + Angebot independently.
// Body: { sections, angebot, branche }
app.post('/api/checkup/gemini', async (req, res) => {
  const { sections, angebot, branche } = req.body || {};
  if (!sections) {
    return res.status(400).json({ error: 'sections sind erforderlich' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY ist nicht konfiguriert' });
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `Du bist ein Qualitätsprüfer für professionelle Gebäudereinigungsangebote.
Prüfe das folgende Leistungsverzeichnis und Angebot (Branche: ${branche || 'unbekannt'}) auf:
1. DUPLIKATE: Identisch oder nahezu identisch formulierte Positionen
2. FEHLENDE POSITIONEN: Branchenübliche Standardleistungen die fehlen
3. PROFESSIONALITÄT: Unprofessionelle oder unklare Formulierungen
4. KONSISTENZ: Widersprüche zwischen LV-Leistungen und kalkuliertem Preis

Leistungsverzeichnis:
${JSON.stringify(sections, null, 2)}

Angebot:
${JSON.stringify(angebot || {}, null, 2)}

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen:
{
  "duplikate": [{"position_a": "...", "position_b": "...", "begruendung": "..."}],
  "fehlende_positionen": [{"position": "...", "begruendung": "..."}],
  "sprachliche_hinweise": [{"original": "...", "verbesserung": "...", "grund": "..."}],
  "konsistenz_probleme": [{"beschreibung": "..."}],
  "bewertung": 8,
  "zusammenfassung": "..."
}`;

    const result = await withTimeout(model.generateContent(prompt), 30000, 'Gemini');
    const raw = result?.response?.text() || '{}';
    const parsed = extractJson(raw);
    res.json(parsed);
  } catch (err) {
    res.status(502).json({ error: err?.message || err?.toString() || 'Gemini Anfrage fehlgeschlagen' });
  }
});

// Dual AI checkup, step 2: Claude reviews the LV + Angebot independently
// AND critiques Gemini's result.
// Body: { sections, angebot, branche, gemini_ergebnis }
app.post('/api/checkup/claude', async (req, res) => {
  const { sections, angebot, branche, gemini_ergebnis } = req.body || {};
  if (!sections) {
    return res.status(400).json({ error: 'sections sind erforderlich' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY ist nicht konfiguriert' });
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `Du bist ein erfahrener Qualitätsprüfer für gewerbliche Reinigungsverträge (Branche: ${branche || 'unbekannt'}).

AUFGABE 1 — Eigene Prüfung:
Analysiere dieses Leistungsverzeichnis und Angebot unabhängig auf Vollständigkeit, Professionalität und Duplikate.

Leistungsverzeichnis:
${JSON.stringify(sections, null, 2)}

Angebot:
${JSON.stringify(angebot || {}, null, 2)}

AUFGABE 2 — Gemini-Review:
Hier ist das Ergebnis einer vorherigen KI-Analyse (Gemini). Bewerte es kritisch:
- Was stimmt in der Gemini-Analyse?
- Was ist falsch oder übertrieben?
- Was hat Gemini übersehen?

Gemini-Ergebnis:
${JSON.stringify(gemini_ergebnis || {}, null, 2)}

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen:
{
  "eigene_pruefung": {
    "duplikate": [{"position_a": "...", "position_b": "...", "begruendung": "..."}],
    "fehlende_positionen": [{"position": "...", "begruendung": "..."}],
    "hinweise": [{"hinweis": "..."}]
  },
  "gemini_bewertung": {
    "korrekte_punkte": ["..."],
    "fehler_oder_uebertreibungen": ["..."],
    "uebersehene_punkte": ["..."]
  },
  "top_prioritaeten": ["1. ...", "2. ...", "3. ..."],
  "freigabe": "bereit",
  "freigabe_begruendung": "...",
  "gesamtresumee": "..."
}
Für "freigabe" gilt ausschließlich "bereit" oder "ueberarbeitung".`;

    const response = await withTimeout(
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
      45000,
      'Claude'
    );

    const textBlock = response?.content?.find((b) => b.type === 'text');
    const parsed = extractJson(textBlock?.text || '{}');
    res.json(parsed);
  } catch (err) {
    res.status(502).json({ error: err?.message || err?.toString() || 'Claude Anfrage fehlgeschlagen' });
  }
});

// LV aus Bild/PDF-Scan generieren (Gemini Vision). Body: raw image/pdf bytes,
// mime type via query param since express.raw only sniffs one content-type.
app.post(
  '/api/lv/from-image',
  express.raw({ type: () => true, limit: '20mb' }),
  async (req, res) => {
    const mimeType = req.query.mimeType;
    if (!mimeType || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'mimeType Query-Parameter und Datei-Body sind erforderlich' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY ist nicht konfiguriert' });
    }
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

      const prompt = `Du analysierst ein Foto oder Scan eines bestehenden Leistungsverzeichnisses
oder einer Reinigungsanforderung. Extrahiere alle Reinigungsleistungen und strukturiere
sie für das Clean Connect LV-Tool.

Antworte NUR als JSON im folgenden Format:
{
  "erkannte_branche": "buero | arztpraxis | treppenhaus | gewerbehalle | kanzlei | kindergarten | sonstiges",
  "bereiche": [
    {
      "name": "Bereichsname (z.B. Büroräume, Empfang, Sanitär)",
      "positionen": [
        {
          "leistung": "Beschreibung der Reinigungsleistung",
          "intervall": "taeglich | 2x_woechentlich | woechentlich | 14taegig | monatlich | quartalsweise | nach_bedarf",
          "wochentage": ["Mo", "Mi", "Fr"],
          "bemerkung": ""
        }
      ]
    }
  ],
  "erkannte_objektdaten": { "adresse": "", "flaeche_gesamt": 0, "stockwerke": 0 },
  "konfidenz": 0.85,
  "hinweise": ["Was nicht eindeutig erkannt werden konnte"]
}

Formuliere alle Leistungen im Clean Connect Stil: professionell, präzise, mit Bodenbelag-Angabe
wenn erkennbar. Beispiel: "Hartböden feucht wischen (bis 180 cm Höhe alle Oberflächen abwischen)"`;

      const result = await withTimeout(
        model.generateContent([
          prompt,
          { inlineData: { data: req.body.toString('base64'), mimeType } },
        ]),
        30000,
        'Gemini'
      );
      const raw = result?.response?.text() || '{}';
      const parsed = extractJson(raw);
      res.json(parsed);
    } catch (err) {
      res.status(502).json({ error: err?.message || err?.toString() || 'Gemini Vision Anfrage fehlgeschlagen' });
    }
  }
);

// Persisted LVs/Angebote. One JSON file per document under DOCUMENTS_DIR.
async function ensureDocumentsDir() {
  await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
}

async function readDocument(id) {
  const raw = await fs.readFile(path.join(DOCUMENTS_DIR, `${id}.json`), 'utf-8');
  return JSON.parse(raw);
}

app.get('/api/documents', async (req, res) => {
  try {
    await ensureDocumentsDir();
    const files = await fs.readdir(DOCUMENTS_DIR);
    const docs = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map((f) => fs.readFile(path.join(DOCUMENTS_DIR, f), 'utf-8').then(JSON.parse))
    );
    const summaries = docs
      .map((d) => ({
        id: d.id,
        parentId: d.parentId || null,
        docType: d.docType || 'main',
        objekt: d.objekt,
        lvTitle: d.lvTitle,
        datum: d.datum,
        updatedAt: d.updatedAt,
        offerNumber: d.offer?.offerNumber || null,
        contactName: d.offer?.contactName || null,
        customer: d.customer || null,
      }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Dokumente konnten nicht geladen werden' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    res.json(await readDocument(req.params.id));
  } catch (err) {
    res.status(404).json({ error: 'Dokument nicht gefunden' });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    await ensureDocumentsDir();
    const now = new Date().toISOString();
    const doc = { ...req.body, id: randomUUID(), createdAt: now, updatedAt: now };
    await fs.writeFile(path.join(DOCUMENTS_DIR, `${doc.id}.json`), JSON.stringify(doc, null, 2));
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Dokument konnte nicht gespeichert werden' });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  try {
    const existing = await readDocument(req.params.id).catch(() => null);
    const merged = {
      ...existing,
      ...req.body,
      offer: req.body.offer !== undefined ? req.body.offer : existing?.offer,
      id: req.params.id,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ensureDocumentsDir();
    await fs.writeFile(path.join(DOCUMENTS_DIR, `${req.params.id}.json`), JSON.stringify(merged, null, 2));
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Dokument konnte nicht aktualisiert werden' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    await fs.unlink(path.join(DOCUMENTS_DIR, `${req.params.id}.json`));
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Dokument nicht gefunden' });
  }
});

// ---------------------------------------------------------------------------
// CRM: Kundenprofile (aggregiert aus documents' customer-Feld, keine eigene
// Kopie der Stammdaten - nur Notizen/Zusatzinfo werden separat gespeichert)
// und Aufträge (verknüpfen ein bestehendes Angebot/LV mit Kalendereinträgen).
// ---------------------------------------------------------------------------

function slugifyCustomerName(name) {
  return (
    (name || 'unbekannt')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'unbekannt'
  );
}

// Ein Kunde wird über die sevDesk-Kontakt-ID identifiziert, wenn vorhanden,
// sonst über einen aus dem Namen abgeleiteten Slug - so werden Kunden über
// mehrere Dokumente hinweg konsistent zusammengeführt, auch ohne sevDesk-ID.
function customerKeyFor(customer) {
  if (!customer) return null;
  if (customer.id) return `sevdesk-${customer.id}`;
  if (customer.name) return `name-${slugifyCustomerName(customer.name)}`;
  return null;
}

async function ensureCrmDirs() {
  await fs.mkdir(CUSTOMERS_DIR, { recursive: true });
  await fs.mkdir(AUFTRAEGE_DIR, { recursive: true });
}

async function loadAllDocuments() {
  await ensureDocumentsDir();
  const files = await fs.readdir(DOCUMENTS_DIR);
  return Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map((f) => fs.readFile(path.join(DOCUMENTS_DIR, f), 'utf-8').then(JSON.parse))
  );
}

async function loadCustomerNotes(key) {
  try {
    const raw = await fs.readFile(path.join(CUSTOMERS_DIR, `${key}.json`), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { notizen: '' };
  }
}

// GET /api/crm/customers - Liste aller Kunden, aggregiert aus den
// vorhandenen LV/Angebot-Dokumenten (keine Datenduplizierung).
app.get('/api/crm/customers', async (req, res) => {
  try {
    const docs = await loadAllDocuments();
    const byKey = new Map();
    for (const d of docs) {
      const key = customerKeyFor(d.customer);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, { key, customer: d.customer, documentCount: 0, lastUpdatedAt: null });
      }
      const entry = byKey.get(key);
      entry.documentCount += 1;
      if (!entry.lastUpdatedAt || d.updatedAt > entry.lastUpdatedAt) {
        entry.lastUpdatedAt = d.updatedAt;
        entry.customer = d.customer; // neueste Version der Stammdaten gewinnt
      }
    }
    const list = Array.from(byKey.values()).sort((a, b) => (a.lastUpdatedAt < b.lastUpdatedAt ? 1 : -1));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Kunden konnten nicht geladen werden' });
  }
});

// GET /api/crm/customers/:key - Profil eines Kunden: Stammdaten, alle
// LVs/Angebote, Notizen, verknüpfte Aufträge.
app.get('/api/crm/customers/:key', async (req, res) => {
  try {
    const docs = await loadAllDocuments();
    const matching = docs.filter((d) => customerKeyFor(d.customer) === req.params.key);
    if (matching.length === 0) {
      return res.status(404).json({ error: 'Kunde nicht gefunden' });
    }
    const newest = matching.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
    await ensureCrmDirs();
    const notes = await loadCustomerNotes(req.params.key);
    let auftraege = [];
    try {
      const files = await fs.readdir(AUFTRAEGE_DIR);
      const all = await Promise.all(
        files.filter((f) => f.endsWith('.json')).map((f) => fs.readFile(path.join(AUFTRAEGE_DIR, f), 'utf-8').then(JSON.parse))
      );
      auftraege = all.filter((a) => a.customerKey === req.params.key);
    } catch {
      auftraege = [];
    }
    res.json({
      key: req.params.key,
      customer: newest.customer,
      documents: matching.map((d) => ({
        id: d.id,
        docType: d.docType || 'main',
        lvTitle: d.lvTitle,
        objekt: d.objekt,
        datum: d.datum,
        updatedAt: d.updatedAt,
        offerNumber: d.offer?.offerNumber || null,
      })),
      notizen: notes.notizen || '',
      auftraege,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Kundenprofil konnte nicht geladen werden' });
  }
});

// PUT /api/crm/customers/:key - nur Notizen (CRM-eigene Zusatzdaten, ändert
// nie die sevDesk-/Dokument-Stammdaten selbst).
app.put('/api/crm/customers/:key', async (req, res) => {
  try {
    await ensureCrmDirs();
    const payload = { notizen: req.body?.notizen || '', updatedAt: new Date().toISOString() };
    await fs.writeFile(path.join(CUSTOMERS_DIR, `${req.params.key}.json`), JSON.stringify(payload, null, 2));
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Notizen konnten nicht gespeichert werden' });
  }
});

// Aufträge: verknüpfen einen Kunden + optional ein bestehendes Angebot/LV
// mit Kalendereinträgen (siehe /api/calendar/*).
app.get('/api/crm/auftraege', async (req, res) => {
  try {
    await ensureCrmDirs();
    const files = await fs.readdir(AUFTRAEGE_DIR);
    const all = await Promise.all(
      files.filter((f) => f.endsWith('.json')).map((f) => fs.readFile(path.join(AUFTRAEGE_DIR, f), 'utf-8').then(JSON.parse))
    );
    res.json(all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Aufträge konnten nicht geladen werden' });
  }
});

app.post('/api/crm/auftraege', async (req, res) => {
  try {
    await ensureCrmDirs();
    const now = new Date().toISOString();
    const auftrag = {
      customerKey: req.body?.customerKey || null,
      customerName: req.body?.customerName || '',
      titel: req.body?.titel || '',
      documentId: req.body?.documentId || null,
      status: req.body?.status || 'offen',
      notizen: req.body?.notizen || '',
      calendarEventIds: req.body?.calendarEventIds || [],
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(path.join(AUFTRAEGE_DIR, `${auftrag.id}.json`), JSON.stringify(auftrag, null, 2));
    res.status(201).json(auftrag);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Auftrag konnte nicht gespeichert werden' });
  }
});

app.put('/api/crm/auftraege/:id', async (req, res) => {
  try {
    const filePath = path.join(AUFTRAEGE_DIR, `${req.params.id}.json`);
    const existing = await fs.readFile(filePath, 'utf-8').then(JSON.parse).catch(() => null);
    if (!existing) return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    const merged = { ...existing, ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
    await fs.writeFile(filePath, JSON.stringify(merged, null, 2));
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Auftrag konnte nicht aktualisiert werden' });
  }
});

app.delete('/api/crm/auftraege/:id', async (req, res) => {
  try {
    await fs.unlink(path.join(AUFTRAEGE_DIR, `${req.params.id}.json`));
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Auftrag nicht gefunden' });
  }
});

// ---------------------------------------------------------------------------
// Google Calendar (Firmen-Account) - OAuth-Flow + Termin-CRUD, ausschließlich
// für unseren eigenen Kalender, nicht für sevDesk. Der Refresh-Token wird
// verschlüsselt-über-Volume (nicht im Git) unter CALENDAR_TOKEN_FILE abgelegt.
// ---------------------------------------------------------------------------

function oauth2ClientFor(req) {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/calendar/oauth/callback`;
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

async function loadCalendarTokens() {
  try {
    return JSON.parse(await fs.readFile(CALENDAR_TOKEN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

async function saveCalendarTokens(tokens) {
  await fs.mkdir(CRM_DIR, { recursive: true });
  await fs.writeFile(CALENDAR_TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// Baut einen authentifizierten Calendar-Client auf Basis des gespeicherten
// Refresh-Tokens. googleapis erneuert den Access-Token automatisch.
async function getCalendarClient(req) {
  const tokens = await loadCalendarTokens();
  if (!tokens?.refresh_token) return null;
  const client = oauth2ClientFor(req);
  client.setCredentials(tokens);
  client.on('tokens', async (newTokens) => {
    await saveCalendarTokens({ ...tokens, ...newTokens });
  });
  return google.calendar({ version: 'v3', auth: client });
}

app.get('/api/calendar/oauth/start', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET sind nicht konfiguriert.');
  }
  const client = oauth2ClientFor(req);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // erzwingt Ausstellung eines refresh_token auch bei erneuter Autorisierung
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.redirect(url);
});

app.get('/api/calendar/oauth/callback', async (req, res) => {
  try {
    const client = oauth2ClientFor(req);
    const { tokens } = await client.getToken(req.query.code);
    if (!tokens.refresh_token) {
      const existing = await loadCalendarTokens();
      if (existing?.refresh_token) tokens.refresh_token = existing.refresh_token;
    }
    await saveCalendarTokens(tokens);
    res.redirect('/?calendar=connected');
  } catch (err) {
    res.status(500).send(`Kalender-Verbindung fehlgeschlagen: ${err?.message || err}`);
  }
});

app.get('/api/calendar/status', async (req, res) => {
  const tokens = await loadCalendarTokens();
  res.json({ connected: !!tokens?.refresh_token, configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

app.get('/api/calendar/events', async (req, res) => {
  try {
    const calendar = await getCalendarClient(req);
    if (!calendar) return res.status(409).json({ error: 'Kalender nicht verbunden' });
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: req.query.timeMin || new Date().toISOString(),
      timeMax: req.query.timeMax || undefined,
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
      privateExtendedProperty: req.query.customerKey ? [`customerKey=${req.query.customerKey}`] : undefined,
    });
    res.json(data.items || []);
  } catch (err) {
    res.status(502).json({ error: err?.message || 'Kalendertermine konnten nicht geladen werden' });
  }
});

app.post('/api/calendar/events', async (req, res) => {
  try {
    const calendar = await getCalendarClient(req);
    if (!calendar) return res.status(409).json({ error: 'Kalender nicht verbunden' });
    const { summary, description, start, end, recurrence, customerKey, auftragId } = req.body || {};
    if (!summary || !start || !end) {
      return res.status(400).json({ error: 'summary, start und end sind erforderlich' });
    }
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start,
        end,
        recurrence,
        extendedProperties: { private: { customerKey: customerKey || '', auftragId: auftragId || '' } },
      },
    });
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || 'Termin konnte nicht erstellt werden' });
  }
});

app.put('/api/calendar/events/:id', async (req, res) => {
  try {
    const calendar = await getCalendarClient(req);
    if (!calendar) return res.status(409).json({ error: 'Kalender nicht verbunden' });
    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: req.params.id,
      requestBody: req.body || {},
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || 'Termin konnte nicht aktualisiert werden' });
  }
});

app.delete('/api/calendar/events/:id', async (req, res) => {
  try {
    const calendar = await getCalendarClient(req);
    if (!calendar) return res.status(409).json({ error: 'Kalender nicht verbunden' });
    await calendar.events.delete({ calendarId: 'primary', eventId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(502).json({ error: err?.message || 'Termin konnte nicht gelöscht werden' });
  }
});

// Exportierte Leistungsverzeichnis-PDFs landen zusätzlich zum Browser-
// Download hier im "Leistungsverzeichnisse"-Ordner auf dem Volume, damit
// man sie später über die Übersicht erneut abrufen kann.
function safePdfFilename(name) {
  return path.basename(name || 'Leistungsverzeichnis.pdf').replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, '_');
}

app.post(
  '/api/lv-pdfs',
  express.raw({ type: 'application/pdf', limit: '20mb' }),
  async (req, res) => {
    try {
      const filename = safePdfFilename(decodeURIComponent(req.get('X-Filename') || ''));
      await fs.mkdir(LV_PDFS_DIR, { recursive: true });
      await fs.writeFile(path.join(LV_PDFS_DIR, filename), req.body);
      res.status(201).json({ success: true, filename });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'PDF konnte nicht gespeichert werden' });
    }
  }
);

app.get('/api/lv-pdfs', async (req, res) => {
  try {
    await fs.mkdir(LV_PDFS_DIR, { recursive: true });
    const files = await fs.readdir(LV_PDFS_DIR);
    const list = await Promise.all(
      files.map(async (f) => {
        const stat = await fs.stat(path.join(LV_PDFS_DIR, f));
        return { filename: f, size: stat.size, mtime: stat.mtime };
      })
    );
    list.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Liste konnte nicht geladen werden' });
  }
});

app.get('/api/lv-pdfs/:filename', (req, res) => {
  const filePath = path.join(LV_PDFS_DIR, safePdfFilename(req.params.filename));
  res.download(filePath, req.params.filename, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'PDF nicht gefunden' });
  });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`LV-Tool server läuft auf Port ${PORT}`);
});

// Exit cleanly on Railway's redeploy/restart signal instead of letting node
// get killed mid-request, which npm reports as a crash in the logs.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
