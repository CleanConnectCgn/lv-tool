// Google Drive Upload. Nutzt dieselbe Firmenkalender-OAuth-Verbindung wie
// server/index.js (server/lib/googleAuth.js), ergänzt um den drive.file-
// Scope (nur Dateien, die diese App selbst anlegt - kein Zugriff auf das
// übrige Drive der Firma).
//
// Zwei getrennte Ablagen:
// - uploadDocumentToDrive(): der alte, flache Ordner "LV-Tool Dokumente" für
//   den dateibasierten CRM-Pfad (JSON-Snapshots, siehe server/index.js).
// - getOrCreateCustomerFolder()/uploadBufferToDrive()/
//   listCustomerDriveDocuments(): neue Struktur "LV-Tool Kunden/<Kunde>" für
//   das Prisma-Datenmodell (Verträge, LVs, Angebote, manuell hochgeladene
//   Scans wie Schlüsselübergabeprotokolle) - ein Ordner pro Customer, dessen
//   ID in Customer.driveFolderId gecacht wird.
//
// Ein Drive-Fehler darf NIEMALS das Speichern/Anlegen eines Dokuments
// verhindern - alle Funktionen hier fangen ihre eigenen Fehler und loggen
// nur, statt zu werfen. Wer die bestehende Kalender-Verbindung VOR diesem
// Update hergestellt hat, hat noch kein drive.file im Token - Google
// liefert dann einen insufficient-scope-Fehler, bis einmal neu verbunden
// wird (siehe "Kalender trennen" + erneut verbinden in der UI). Das wird
// hier als normaler, stiller Fehlerfall behandelt, kein Crash.
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { prisma } from './prisma.js';

export const DRIVE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'LV-Tool Dokumente';
const ROOT_FOLDER_NAME = 'LV-Tool Kunden';

function isInvalidGrant(err) {
  const message = err?.message || String(err);
  return message.includes('invalid_grant') || err?.code === 401 || err?.response?.status === 401;
}

function folderCacheFile(crmDir) {
  return path.join(crmDir, 'drive-folder.json');
}

async function loadCachedFolderId(crmDir) {
  try {
    const data = JSON.parse(await fs.readFile(folderCacheFile(crmDir), 'utf-8'));
    return data.folderId || null;
  } catch {
    return null;
  }
}

async function saveCachedFolderId(crmDir, folderId) {
  await fs.mkdir(crmDir, { recursive: true });
  await fs.writeFile(folderCacheFile(crmDir), JSON.stringify({ folderId }, null, 2));
}

async function findOrCreateFolder(drive, crmDir) {
  const cached = await loadCachedFolderId(crmDir);
  if (cached) return cached;

  const search = await drive.files.list({
    q: `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  let folderId = search.data.files?.[0]?.id;
  if (!folderId) {
    const created = await drive.files.create({
      requestBody: { name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = created.data.id;
  }
  await saveCachedFolderId(crmDir, folderId);
  return folderId;
}

// oauthClient: derselbe authentifizierte google.auth.OAuth2-Client, der auch
// für den Firmenkalender genutzt wird (null, wenn nicht verbunden).
export async function uploadDocumentToDrive({ oauthClient, crmDir, filename, jsonContent }) {
  if (!oauthClient) return { uploaded: false, reason: 'not_connected' };
  try {
    const drive = google.drive({ version: 'v3', auth: oauthClient });
    const folderId = await findOrCreateFolder(drive, crmDir);
    await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: 'application/json', body: jsonContent },
      fields: 'id',
    });
    return { uploaded: true };
  } catch (err) {
    console.error('Google-Drive-Upload fehlgeschlagen (Dokument bleibt trotzdem gespeichert):', err?.message || err);
    // Vorher wurde ein widerrufener/abgelaufener Token hier genauso "still"
    // behandelt wie jeder andere Fehler - im Gegensatz zu den Kalender-
    // Routen (server/index.js handleCalendarError), die genau das erkennen
    // und den gespeicherten Token löschen, damit die UI "Verbindung
    // erneuern" anzeigt. Ohne diese Erkennung hätten Drive-Uploads nach
    // einem Widerruf einfach für immer unbemerkt aufgehört, während
    // /api/calendar/status weiterhin "connected: true" gemeldet hätte
    // (prüft nur, ob die Token-Datei existiert, nicht ob sie noch gültig
    // ist). Gefunden beim Audit 2026-07-30.
    return { uploaded: false, reason: isInvalidGrant(err) ? 'invalid_grant' : err?.message || 'error' };
  }
}

let cachedRootFolderId = null;

async function findOrCreateRootFolder(drive) {
  if (cachedRootFolderId) return cachedRootFolderId;
  const search = await drive.files.list({
    q: `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  let folderId = search.data.files?.[0]?.id;
  if (!folderId) {
    const created = await drive.files.create({
      requestBody: { name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = created.data.id;
  }
  cachedRootFolderId = folderId;
  return folderId;
}

// Prüft Customer.driveFolderId (DB-Cache), legt sonst einen neuen
// Unterordner unter dem Root-Ordner "LV-Tool Kunden" an und schreibt die ID
// zurück. Eine spätere Umbenennung des Kunden benennt den Drive-Ordner NICHT
// automatisch um (bewusst: die Ordner-ID bleibt stabil, kein Nachführen
// nötig).
export async function getOrCreateCustomerFolder(drive, customer) {
  if (customer.driveFolderId) return customer.driveFolderId;

  const rootId = await findOrCreateRootFolder(drive);
  const created = await drive.files.create({
    requestBody: { name: customer.name, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
  });
  const folderId = created.data.id;
  await prisma.customer.update({ where: { id: customer.id }, data: { driveFolderId: folderId } });
  return folderId;
}

// Lädt eine echte Binärdatei (PDF/DOCX) in den Kunden-Ordner hoch - Pendant
// zu uploadDocumentToDrive() oben, aber für Buffer statt JSON-Text.
export async function uploadBufferToDrive({ oauthClient, customer, filename, buffer, mimeType }) {
  if (!oauthClient) return { uploaded: false, reason: 'not_connected' };
  try {
    const drive = google.drive({ version: 'v3', auth: oauthClient });
    const folderId = await getOrCreateCustomerFolder(drive, customer);
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: 'id, webViewLink',
    });
    return { uploaded: true, fileId: created.data.id, webViewLink: created.data.webViewLink };
  } catch (err) {
    console.error('Google-Drive-Upload fehlgeschlagen (Vorgang bleibt trotzdem gespeichert):', err?.message || err);
    return { uploaded: false, reason: isInvalidGrant(err) ? 'invalid_grant' : err?.message || 'error' };
  }
}

// Listet die Dateien im Kunden-Ordner (für den "Dokumente"-Tab im
// Kundenprofil) - kein lokaler Index nötig, Drive selbst ist die Quelle.
export async function listCustomerDriveDocuments({ oauthClient, customer }) {
  if (!oauthClient) return { listed: false, reason: 'not_connected', files: [] };
  if (!customer.driveFolderId) return { listed: true, files: [] };
  try {
    const drive = google.drive({ version: 'v3', auth: oauthClient });
    const result = await drive.files.list({
      q: `'${customer.driveFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, createdTime, mimeType)',
      orderBy: 'createdTime desc',
      spaces: 'drive',
    });
    return { listed: true, files: result.data.files || [] };
  } catch (err) {
    console.error('Google-Drive-Auflistung fehlgeschlagen:', err?.message || err);
    return { listed: false, reason: isInvalidGrant(err) ? 'invalid_grant' : err?.message || 'error', files: [] };
  }
}
