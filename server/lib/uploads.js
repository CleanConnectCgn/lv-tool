// Block 7: Upload und Auslesung. Hochladen von PDF/Bild an Kunde ODER
// Objekt, dann Auslesung über den austauschbaren Adapter (server/lib/
// extraction/). Es wird NIE ein Dokument/Leistungsverzeichnis erzeugt, ohne
// dass ein Mensch das Ergebnis im Review-Editor bestätigt hat - dieser
// Endpoint speichert nur die Datei + das rohe Auslese-Ergebnis, niemals
// direkt ein ServiceSpec (das passiert erst über den bestehenden Block-5-
// Endpoint POST /api/db/objects/:id/service-specs, ausgelöst vom Menschen).
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { prisma } from './prisma.js';
import { extractDocument } from './extraction/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function safeFilename(name) {
  return path.basename(name || 'upload').replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, '_');
}

async function runExtractionFor(upload) {
  const fileBuffer = await fs.readFile(path.join(UPLOADS_DIR, upload.fileUrl));
  const catalog = await prisma.serviceCatalogItem.findMany({ where: { aktiv: true } });
  try {
    const result = await extractDocument({ fileBuffer, mimeType: upload.fileType, catalog });
    const extractionResult = { status: 'ok', ...result };
    await prisma.upload.update({ where: { id: upload.id }, data: { extractionResult } });
    return extractionResult;
  } catch (err) {
    // "Bei fehlgeschlagener Auslesung eine klare Meldung, was fehlt, und die
    // Möglichkeit, es erneut zu versuchen oder von Hand zu erfassen" - die
    // Datei bleibt gespeichert, nur das Ergebnis trägt den Fehler.
    const extractionResult = { status: 'failed', error: err?.message || 'Auslesung fehlgeschlagen' };
    await prisma.upload.update({ where: { id: upload.id }, data: { extractionResult } });
    return extractionResult;
  }
}

export function registerUploadRoutes(app) {
  // mimeType als Query-Param (gleiches Muster wie /api/lv/from-image),
  // da express.raw() den Content-Type der hochgeladenen Datei akzeptieren
  // muss statt ihn vorzuschreiben.
  app.post('/api/db/uploads', express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
    const { customerId, objectId, mimeType } = req.query;
    if (!customerId && !objectId) {
      return res.status(400).json({ error: 'customerId oder objectId ist erforderlich' });
    }
    if (!mimeType || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'mimeType Query-Parameter und Datei-Body sind erforderlich' });
    }
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const storedFilename = `${randomUUID()}_${safeFilename(decodeURIComponent(req.get('X-Filename') || 'upload'))}`;
      await fs.writeFile(path.join(UPLOADS_DIR, storedFilename), req.body);

      const upload = await prisma.upload.create({
        data: {
          fileUrl: storedFilename,
          fileType: mimeType,
          customerId: customerId || null,
          objectId: objectId || null,
          ownerId: req.user?.id || null,
        },
      });

      const extractionResult = await runExtractionFor(upload);
      res.status(201).json({ upload: { ...upload, extractionResult }, extraction: extractionResult });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Upload fehlgeschlagen' });
    }
  });

  app.post('/api/db/uploads/:id/retry', async (req, res) => {
    try {
      const upload = await prisma.upload.findUnique({ where: { id: req.params.id } });
      if (!upload) return res.status(404).json({ error: 'Upload nicht gefunden' });
      const extractionResult = await runExtractionFor(upload);
      res.json({ extraction: extractionResult });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Erneute Auslesung fehlgeschlagen' });
    }
  });

  app.get('/api/db/uploads/:id', async (req, res) => {
    try {
      const upload = await prisma.upload.findUnique({ where: { id: req.params.id } });
      if (!upload) return res.status(404).json({ error: 'Upload nicht gefunden' });
      res.json(upload);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Upload konnte nicht geladen werden' });
    }
  });

  app.get('/api/db/uploads', async (req, res) => {
    try {
      const where = {};
      if (req.query.customerId) where.customerId = req.query.customerId;
      if (req.query.objectId) where.objectId = req.query.objectId;
      const rows = await prisma.upload.findMany({ where, orderBy: { createdAt: 'desc' } });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Uploads konnten nicht geladen werden' });
    }
  });
}
