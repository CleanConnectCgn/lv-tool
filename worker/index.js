// Prozess-Einstieg des Backup-Workers (Block 4). Läuft als eigener Railway-
// Dienst (siehe scripts/start.js: SERVICE_ROLE=backup-worker). Kein
// öffentliches Domain nötig - erreichbar nur über Railways privates
// Netzwerk vom Haupt-Server aus (POST /api/backup/run-now in server/index.js).
import express from 'express';
import { scheduleDailyBackup, runBackupWithFailureMail } from './backup.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => res.json({ ok: true }));

// Zusätzliche Absicherung per Shared Secret (WORKER_INTERNAL_TOKEN), auch
// wenn dieser Dienst kein öffentliches Domain hat.
app.post('/run-now', async (req, res) => {
  const token = req.headers['x-worker-token'];
  if (!process.env.WORKER_INTERNAL_TOKEN || token !== process.env.WORKER_INTERNAL_TOKEN) {
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
