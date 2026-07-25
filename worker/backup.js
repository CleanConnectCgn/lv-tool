// Block 4: pg_dump täglich um 03:00 (Europe/Berlin), komprimiert, 30 Tage
// Aufbewahrung, Mail an den Betreiber bei Fehlschlag. Reine Logik hier -
// Prozess-Verkabelung (Scheduler, HTTP-Listener) liegt in worker/index.js.
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { ensureBackupDir, backupFilePath, pruneOldBackups } from './storage.js';
import { sendOperatorMail } from '../server/lib/mailer.js';

const RETENTION_DAYS = 30;

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function runBackupOnce() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ist nicht konfiguriert');
  await ensureBackupDir();
  const filename = `lv-tool-backup_${timestampForFilename()}.sql.gz`;
  const targetPath = backupFilePath(filename);

  const dump = spawn('pg_dump', [process.env.DATABASE_URL, '--no-owner', '--no-privileges'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  dump.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  // Beide Listener SYNCHRON direkt nach spawn() anhängen (vor jedem await) -
  // sonst könnte das 'close'-Event feuern, bevor wir zuhören.
  const exitPromise = new Promise((resolve, reject) => {
    dump.on('error', reject); // z.B. pg_dump-Binary nicht gefunden
    dump.on('close', (code) => {
      if (code !== 0) reject(new Error(`pg_dump beendete sich mit Code ${code}: ${stderr.trim()}`));
      else resolve();
    });
  });
  const pipelinePromise = pipeline(dump.stdout, zlib.createGzip(), createWriteStream(targetPath));

  await Promise.all([exitPromise, pipelinePromise]);

  const removedOldBackups = await pruneOldBackups(RETENTION_DAYS);
  return { filename, removedOldBackups };
}

export async function runBackupWithFailureMail() {
  try {
    const result = await runBackupOnce();
    console.log(`Backup erfolgreich: ${result.filename}`);
    if (result.removedOldBackups.length) {
      console.log(`Alte Backups entfernt (>${RETENTION_DAYS} Tage): ${result.removedOldBackups.join(', ')}`);
    }
    return result;
  } catch (err) {
    console.error('Backup fehlgeschlagen:', err?.message || err);
    await sendOperatorMail({
      subject: 'LV-Tool: Backup fehlgeschlagen',
      text: `Der tägliche Datenbank-Backup ist fehlgeschlagen:\n\n${err?.message || err}`,
    }).catch((mailErr) => console.error('Fehlschlag-Mail konnte nicht gesendet werden:', mailErr?.message || mailErr));
    throw err;
  }
}

// Aktuellen Google-UTC-Offset für Europe/Berlin ermitteln (berücksichtigt
// Sommer-/Winterzeit automatisch, ohne externe Zeitzonen-Library).
function berlinOffsetMs(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

// Millisekunden bis zum nächsten 03:00 Berlin-Ortszeit. Wird vor JEDEM Lauf
// neu berechnet (nicht per festem 24h-Interval), damit ein DST-Wechsel sich
// von selbst korrigiert statt dauerhaft zu verschieben.
export function msUntilNextBerlin3am(now = new Date()) {
  const offset = berlinOffsetMs(now);
  const nowAsBerlinWallClock = new Date(now.getTime() + offset);
  const target = new Date(
    Date.UTC(
      nowAsBerlinWallClock.getUTCFullYear(),
      nowAsBerlinWallClock.getUTCMonth(),
      nowAsBerlinWallClock.getUTCDate(),
      3,
      0,
      0,
      0
    )
  );
  if (target <= nowAsBerlinWallClock) target.setUTCDate(target.getUTCDate() + 1);
  const targetRealUtcMs = target.getTime() - offset;
  return targetRealUtcMs - now.getTime();
}

export function scheduleDailyBackup() {
  function tick() {
    runBackupWithFailureMail().finally(() => {
      const delay = msUntilNextBerlin3am();
      console.log(`Nächstes automatisches Backup in ${Math.round(delay / 60000)} Minuten.`);
      setTimeout(tick, delay);
    });
  }
  const initialDelay = msUntilNextBerlin3am();
  console.log(`Erstes automatisches Backup in ${Math.round(initialDelay / 60000)} Minuten (03:00 Europe/Berlin).`);
  setTimeout(tick, initialDelay);
}
