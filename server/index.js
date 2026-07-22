import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Where saved LV/Angebot documents are stored. On Railway this needs a
// Volume mounted at this path, otherwise the directory is wiped on every
// redeploy (the container filesystem is ephemeral).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');

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
app.post('/api/sevdesk/request', async (req, res) => {
  const { method = 'GET', path: sevPath, body } = req.body || {};
  const token = req.body?.token || process.env.SEVDESK_TOKEN;
  if (!token || !sevPath) {
    return res.status(400).json({ error: 'token und path sind erforderlich' });
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
        objekt: d.objekt,
        lvTitle: d.lvTitle,
        datum: d.datum,
        updatedAt: d.updatedAt,
        offerNumber: d.offer?.offerNumber || null,
        contactName: d.offer?.contactName || null,
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

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LV-Tool server läuft auf Port ${PORT}`);
});
