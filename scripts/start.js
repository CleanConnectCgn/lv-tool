// Einstiegspunkt für `npm start`. Startet je nach SERVICE_ROLE entweder den
// Web-Server (Standard, wenn die Variable fehlt - bestehendes Verhalten
// bleibt unverändert) oder den Backup-Worker (Block 4) - beide leben im
// selben Repo/Deploy-Artefakt, laufen aber als zwei getrennte Railway-Dienste
// mit jeweils eigener SERVICE_ROLE-Variable.
import { execFileSync } from 'node:child_process';

if (process.env.SERVICE_ROLE === 'backup-worker') {
  await import('../worker/index.js');
} else {
  // Migrationen VOR dem Serverstart anwenden. Railway baut das Image zwar
  // mit `prisma generate`, führt aber `prisma migrate deploy` nicht
  // automatisch aus - fehlende Spalten/Tabellen (z.B. service_spec_items.
  // einmalig oder inbox_documents) fallen sonst erst zur Laufzeit auf und
  // legen Import/Verträge still. `migrate deploy` ist idempotent und wendet
  // nur ausstehende Migrationen an. Nur der Web-Dienst migriert (der
  // Backup-Worker soll die Datenbank nicht verändern und läuft evtl.
  // parallel), und nur wenn eine DATABASE_URL konfiguriert ist.
  if (process.env.DATABASE_URL) {
    try {
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      execFileSync(npx, ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
    } catch (err) {
      console.error('[start] prisma migrate deploy fehlgeschlagen:', err?.message || err);
      process.exit(1);
    }
  } else {
    console.warn('[start] DATABASE_URL fehlt - überspringe Migrationen (nur für lokale Entwicklung ohne DB).');
  }

  const { startServer } = await import('../server/index.js');
  startServer();
}
