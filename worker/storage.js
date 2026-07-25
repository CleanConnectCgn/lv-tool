// Speicher-Adapter für Backups. Aktuell: Railway-Volume (Übergangslösung,
// vom Nutzer bewusst gewählt statt sofort S3/Cloudflare R2 anzubinden - siehe
// Auftrag Block 4/D3). Ein späterer Wechsel auf einen echten S3-kompatiblen
// Speicher betrifft NUR diese Datei (saveBackup/listBackups/pruneOldBackups
// austauschen), der Rest von worker/backup.js bleibt unverändert.
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';

export async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

export function backupFilePath(filename) {
  return path.join(BACKUP_DIR, filename);
}

export async function listBackups() {
  await ensureBackupDir();
  const files = await fs.readdir(BACKUP_DIR);
  return files.filter((f) => f.endsWith('.sql.gz'));
}

// 30 Tage Aufbewahrung (Auftrag Block 4) - ältere Dumps werden nach jedem
// erfolgreichen Lauf entfernt.
export async function pruneOldBackups(maxAgeDays = 30) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const files = await listBackups();
  const removed = [];
  for (const f of files) {
    const full = backupFilePath(f);
    const stat = await fs.stat(full).catch(() => null);
    if (stat && stat.mtimeMs < cutoff) {
      await fs.unlink(full).catch(() => {});
      removed.push(f);
    }
  }
  return removed;
}
