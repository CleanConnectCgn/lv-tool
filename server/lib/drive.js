// Google Drive Upload für "jedes gespeicherte Dokument" (Auftrag Block 4).
// Nutzt dieselbe Firmenkalender-OAuth-Verbindung wie server/index.js
// (CALENDAR_TOKEN_FILE), ergänzt um den drive.file-Scope (nur Dateien, die
// diese App selbst anlegt - kein Zugriff auf das übrige Drive der Firma).
//
// Ein Drive-Fehler darf NIEMALS das Speichern eines Dokuments verhindern -
// alle Funktionen hier fangen ihre eigenen Fehler und loggen nur, statt zu
// werfen. Wer die bestehende Kalender-Verbindung VOR diesem Block 4-Update
// hergestellt hat, hat noch kein drive.file im Token - Google liefert dann
// einen insufficient-scope-Fehler, bis einmal neu verbunden wird (siehe
// "Kalender trennen" + erneut verbinden in der UI). Das wird hier als
// normaler, stiller Fehlerfall behandelt, kein Crash.
import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';

export const DRIVE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'LV-Tool Dokumente';

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
    const message = err?.message || String(err);
    const invalidGrant = message.includes('invalid_grant') || err?.code === 401 || err?.response?.status === 401;
    return { uploaded: false, reason: invalidGrant ? 'invalid_grant' : message || 'error' };
  }
}
