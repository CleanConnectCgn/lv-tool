// Manuelle Dokumentenablage pro Kunde (Google Drive, siehe drive.js) - für
// Scans, die nicht im Tool erzeugt werden (unterschriebene Papierverträge,
// Schlüsselübergabeprotokolle, sonstige Unterlagen). Anders als
// server/lib/uploads.js (Block 7): kein lokales Schreiben, keine
// Auslesung/Extraktion - die Datei geht direkt in den Kunden-Ordner in
// Drive, Drive selbst ist die einzige Ablage (kein lokaler Index nötig).
import express from 'express';
import { prisma } from './prisma.js';
import { getGoogleOAuthClient } from './googleAuth.js';
import { uploadBufferToDrive, listCustomerDriveDocuments } from './drive.js';

function safeFilename(name) {
  return (name || 'Dokument').replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, '_');
}

export function registerCustomerDocumentRoutes(app) {
  app.post(
    '/api/db/customers/:id/documents',
    express.raw({ type: () => true, limit: '20mb' }),
    async (req, res) => {
      const { mimeType } = req.query;
      if (!mimeType || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'mimeType Query-Parameter und Datei-Body sind erforderlich' });
      }
      try {
        const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
        if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

        const oauthClient = await getGoogleOAuthClient(req);
        if (!oauthClient) {
          return res.status(409).json({ error: 'Google Drive ist nicht verbunden (siehe Kalender-Verbindung)' });
        }

        const filename = safeFilename(decodeURIComponent(req.get('X-Filename') || 'Dokument'));
        const result = await uploadBufferToDrive({
          oauthClient,
          customer,
          filename,
          buffer: req.body,
          mimeType,
        });
        if (!result.uploaded) {
          return res.status(502).json({ error: `Drive-Upload fehlgeschlagen: ${result.reason}` });
        }
        res.status(201).json({ fileId: result.fileId, webViewLink: result.webViewLink, filename });
      } catch (err) {
        res.status(500).json({ error: err?.message || 'Dokument-Upload fehlgeschlagen' });
      }
    }
  );

  app.get('/api/db/customers/:id/documents', async (req, res) => {
    try {
      const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

      const oauthClient = await getGoogleOAuthClient(req);
      if (!oauthClient) {
        return res.status(409).json({ error: 'Google Drive ist nicht verbunden (siehe Kalender-Verbindung)' });
      }

      const { listed, reason, files } = await listCustomerDriveDocuments({ oauthClient, customer });
      if (!listed) {
        return res.status(502).json({ error: `Drive-Auflistung fehlgeschlagen: ${reason}` });
      }
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Dokumente konnten nicht geladen werden' });
    }
  });
}
