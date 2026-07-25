// Einstiegspunkt für `npm start`. Startet je nach SERVICE_ROLE entweder den
// Web-Server (Standard, wenn die Variable fehlt - bestehendes Verhalten
// bleibt unverändert) oder den Backup-Worker (Block 4) - beide leben im
// selben Repo/Deploy-Artefakt, laufen aber als zwei getrennte Railway-Dienste
// mit jeweils eigener SERVICE_ROLE-Variable.
if (process.env.SERVICE_ROLE === 'backup-worker') {
  await import('../worker/index.js');
} else {
  const { startServer } = await import('../server/index.js');
  startServer();
}
