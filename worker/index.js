// Prozess-Einstieg des Backup-Workers (Block 4). Läuft als eigener Railway-
// Dienst (siehe scripts/start.js: SERVICE_ROLE=backup-worker). Kein
// öffentliches Domain nötig - erreichbar nur über Railways privates
// Netzwerk vom Haupt-Server aus (POST /api/backup/run-now in server/index.js).
import express from 'express';
import crypto from 'crypto';
import { scheduleDailyBackup, runBackupWithFailureMail } from './backup.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => res.json({ ok: true }));

// Zeitkonstanter Vergleich statt "!==" (gefunden beim Audit 2026-07-30) -
// geringes Risiko, da dieser Dienst nur aus Railways privatem Netzwerk
// erreichbar ist, aber inkonsistent mit dem bereits zeitkonstanten
// Session-Token-Vergleich in server/lib/auth.js. timingSafeEqual verlangt
// gleich lange Buffer, daher erst die Länge prüfen (das allein verrät
// praktisch nichts Verwertbares bei einem zufälligen Token).
function isValidWorkerToken(candidate) {
  const expected = process.env.WORKER_INTERNAL_TOKEN;
  if (!expected || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Zusätzliche Absicherung per Shared Secret (WORKER_INTERNAL_TOKEN), auch
// wenn dieser Dienst kein öffentliches Domain hat.
app.post('/run-now', async (req, res) => {
  if (!isValidWorkerToken(req.headers['x-worker-token'])) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }
  try {
    const result = await runBackupWithFailureMail();
    res.json({ success: true, ...result });
  } catch (err) {
    // runBackupWithFailureMail hat die Fehlschlag-Mail bereits verschickt -
    // hier nur den Aufrufer informieren.
    res.status(500).json({ error: err?.message || 'Backup fehlgeschlagen' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Backup-Worker läuft auf Port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

scheduleDailyBackup();
