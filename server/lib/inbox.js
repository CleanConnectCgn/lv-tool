// Eingangs-Ablage (Posteingang): Datei hochladen -> KI liest Kunde/Objekt/
// Dokumenttyp aus -> passende Kunden vorgeschlagen -> nach menschlicher
// Bestätigung Ablage im Drive-Kundenordner (server/lib/drive.js). Anders als
// server/lib/customerDocuments.js (Datei zu einem BEREITS bekannten Kunden)
// ist hier der Kunde zu Beginn unbekannt - deshalb lokaler Zwischenspeicher
// bis zur Bestätigung, kein direkter Drive-Upload.
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { prisma } from './prisma.js';
import { extractInboxDocument } from './extraction/geminiInbox.js';
import { findCustomerMatches } from './customerMatching.js';
import { getGoogleOAuthClient } from './googleAuth.js';
import { uploadBufferToDrive } from './drive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const INBOX_DIR = path.join(DATA_DIR, 'inbox');

function safeFilename(name) {
  return path.basename(name || 'dokument').replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, '_');
}

// Läuft nach dem Speichern der Datei asynchron im Hintergrund (der Upload-
// Request muss nicht auf Gemini warten) - Ergebnis wird per Update auf die
// bereits angelegte InboxDocument-Zeile geschrieben, das UI holt es per
// Polling über GET /api/inbox.
async function runExtractionFor(doc) {
  try {
    const fileBuffer = await fs.readFile(path.join(INBOX_DIR, doc.storagePath));
    const extracted = await extractInboxDocument({ fileBuffer, mimeType: doc.mimeType });
    const matchCandidates = await findCustomerMatches(extracted.kundenname, extracted.objektadresse);
    await prisma.inboxDocument.update({
      where: { id: doc.id },
      data: {
        extractedCustomerName: extracted.kundenname,
        extractedAddress: extracted.objektadresse,
        extractedDocType: extracted.dokumenttyp,
        extractedDate: extracted.datum,
        matchCandidates,
        matchedCustomerId: matchCandidates[0]?.customerId || null,
      },
    });
  } catch (err) {
    console.error('[inbox] Auslesung fehlgeschlagen:', err?.message || err);
    // Datei bleibt trotzdem in der Ablage liegen - manuelle Zuordnung im UI
    // bleibt möglich, auch wenn die KI-Auslesung nicht geklappt hat.
    await prisma.inboxDocument
      .update({ where: { id: doc.id }, data: { extractedDocType: null } })
      .catch(() => {});
  }
}

export function registerInboxRoutes(app) {
  app.post('/api/inbox/upload', express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
    const { mimeType } = req.query;
    if (!mimeType || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'mimeType Query-Parameter und Datei-Body sind erforderlich' });
    }
    try {
      await fs.mkdir(INBOX_DIR, { recursive: true });
      const filename = safeFilename(decodeURIComponent(req.get('X-Filename') || 'Dokument'));
      const storagePath = `${randomUUID()}_${filename}`;
      await fs.writeFile(path.join(INBOX_DIR, storagePath), req.body);

      const doc = await prisma.inboxDocument.create({
        data: { filename, mimeType, storagePath, ownerId: req.user?.id || null },
      });

      res.status(201).json(doc);
      // Bewusst nicht awaited - der Upload soll sofort bestätigt werden,
      // die Auslesung läuft im Hintergrund weiter (siehe runExtractionFor).
      runExtractionFor(doc);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Upload fehlgeschlagen' });
    }
  });

  app.get('/api/inbox', async (req, res) => {
    try {
      const docs = await prisma.inboxDocument.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        include: { matchedCustomer: { select: { id: true, name: true } } },
      });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Posteingang konnte nicht geladen werden' });
    }
  });

  app.post('/api/inbox/:id/confirm', async (req, res) => {
    const { customerId } = req.body || {};
    if (!customerId) return res.status(400).json({ error: 'customerId ist erforderlich' });
    try {
      const doc = await prisma.inboxDocument.findUnique({ where: { id: req.params.id } });
      if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden' });
      if (doc.status !== 'pending') return res.status(409).json({ error: 'Dokument ist nicht mehr offen' });

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

      const oauthClient = await getGoogleOAuthClient(req);
      if (!oauthClient) {
        return res.status(409).json({ error: 'Google Drive ist nicht verbunden (siehe Kalender-Verbindung)' });
      }

      const fileBuffer = await fs.readFile(path.join(INBOX_DIR, doc.storagePath));
      const result = await uploadBufferToDrive({
        oauthClient,
        customer,
        filename: doc.filename,
        buffer: fileBuffer,
        mimeType: doc.mimeType,
      });
      if (!result.uploaded) {
        return res.status(502).json({ error: `Drive-Upload fehlgeschlagen: ${result.reason}` });
      }

      await prisma.inboxDocument.update({
        where: { id: doc.id },
        data: { status: 'confirmed', matchedCustomerId: customerId },
      });
      await fs.rm(path.join(INBOX_DIR, doc.storagePath), { force: true });

      res.json({ uploaded: true, fileId: result.fileId, webViewLink: result.webViewLink });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Bestätigung fehlgeschlagen' });
    }
  });

  app.post('/api/inbox/:id/reject', async (req, res) => {
    try {
      const doc = await prisma.inboxDocument.findUnique({ where: { id: req.params.id } });
      if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden' });
      await prisma.inboxDocument.update({ where: { id: doc.id }, data: { status: 'rejected' } });
      await fs.rm(path.join(INBOX_DIR, doc.storagePath), { force: true });
      res.json({ rejected: true });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Ablehnen fehlgeschlagen' });
    }
  });
}
