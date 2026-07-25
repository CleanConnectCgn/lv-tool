import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import zlib from 'zlib';

let msUntilNextBerlin3am, runBackupOnce, backupDir;

beforeAll(async () => {
  backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lv-tool-backup-test-'));
  process.env.BACKUP_DIR = backupDir;
  const mod = await import('./backup.js');
  msUntilNextBerlin3am = mod.msUntilNextBerlin3am;
  runBackupOnce = mod.runBackupOnce;
});

afterAll(async () => {
  await fs.rm(backupDir, { recursive: true, force: true });
});

describe('msUntilNextBerlin3am', () => {
  it('rechnet auf denselben Tag 03:00, wenn es noch früher Morgen ist (Winterzeit, UTC+1)', () => {
    // 2026-01-15 01:00 Berlin-Ortszeit (Winterzeit, UTC+1) = 2026-01-15T00:00:00Z
    const now = new Date('2026-01-15T00:00:00Z');
    const delay = msUntilNextBerlin3am(now);
    const target = new Date(now.getTime() + delay);
    expect(target.toISOString()).toBe('2026-01-15T02:00:00.000Z'); // 03:00 Berlin = 02:00 UTC im Winter
  });

  it('rechnet auf den nächsten Tag, wenn 03:00 Berlin heute schon vorbei ist', () => {
    // 2026-01-15 10:00 Berlin (UTC+1) = 2026-01-15T09:00:00Z
    const now = new Date('2026-01-15T09:00:00Z');
    const delay = msUntilNextBerlin3am(now);
    const target = new Date(now.getTime() + delay);
    expect(target.toISOString()).toBe('2026-01-16T02:00:00.000Z');
  });

  it('berücksichtigt die Sommerzeit (UTC+2)', () => {
    // 2026-07-15 01:00 Berlin-Ortszeit (Sommerzeit, UTC+2) = 2026-07-14T23:00:00Z
    const now = new Date('2026-07-14T23:00:00Z');
    const delay = msUntilNextBerlin3am(now);
    const target = new Date(now.getTime() + delay);
    expect(target.toISOString()).toBe('2026-07-15T01:00:00.000Z'); // 03:00 Berlin = 01:00 UTC im Sommer
  });

  it('liefert immer einen positiven Wert', () => {
    expect(msUntilNextBerlin3am(new Date())).toBeGreaterThan(0);
  });
});

describe('runBackupOnce (gegen die echte, per DATABASE_URL erreichbare Postgres-Instanz)', () => {
  it('erzeugt einen komprimierten, gültigen SQL-Dump und schreibt ihn in BACKUP_DIR', async () => {
    const result = await runBackupOnce();
    expect(result.filename).toMatch(/^lv-tool-backup_.*\.sql\.gz$/);

    const fullPath = path.join(backupDir, result.filename);
    const gzipped = await fs.readFile(fullPath);
    expect(gzipped.length).toBeGreaterThan(0);

    const sql = zlib.gunzipSync(gzipped).toString('utf-8');
    // pg_dump-Header + mindestens eine unserer echten Tabellen aus dem
    // Prisma-Schema (Block 2) müssen im Dump vorkommen.
    expect(sql).toContain('PostgreSQL database dump');
    expect(sql).toMatch(/CREATE TABLE public\.(customers|users|objects)/);
  }, 30000);

  it('räumt Backups auf, die älter als 30 Tage sind', async () => {
    const oldFile = path.join(backupDir, 'lv-tool-backup_alt.sql.gz');
    await fs.writeFile(oldFile, 'alt');
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile, oldDate, oldDate);

    const result = await runBackupOnce();
    expect(result.removedOldBackups).toContain('lv-tool-backup_alt.sql.gz');
    await expect(fs.access(oldFile)).rejects.toThrow();
  }, 30000);
});
