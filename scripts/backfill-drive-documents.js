// Einmaliges Backfill: rendert für alle bestehenden Contract-Einträge
// DOCX+PDF (und AVV, falls die DSGVO-Variante das verlangt) und lädt sie
// nachträglich in den jeweiligen Kunden-Ordner in Google Drive hoch (siehe
// server/lib/drive.js, server/lib/documentRoutes.js
// archiveContractToDriveIfConnected - dieses Skript nutzt exakt dieselbe
// Render-/Upload-Logik, nur für bereits bestehende statt neu angelegte
// Verträge).
//
// Braucht Zugriff auf denselben gespeicherten Google-Refresh-Token wie der
// Server (server/lib/googleAuth.js liest ihn unter
// $DATA_DIR/crm/calendar-token.json) - läuft daher am einfachsten direkt auf
// dem Railway-Dienst (railway run node scripts/backfill-drive-documents.js),
// nicht lokal ohne Kopie dieses Tokens.
//
// Aufruf:
//   DATABASE_URL=... DATA_DIR=... node scripts/backfill-drive-documents.js [--apply]
// Ohne --apply: reiner Trockenlauf (zeigt nur, was hochgeladen würde).
import { PrismaClient } from '@prisma/client';
import { buildContractDocument } from '../server/lib/render/contractDocx.js';
import { buildAvvDocument } from '../server/lib/render/avvDocx.js';
import { buildContractPdf } from '../server/lib/render/contractPdf.js';
import { buildAvvPdf } from '../server/lib/render/avvPdf.js';
import { DSGVO_VARIANTEN } from '../server/lib/render/contractFields.js';
import { getGoogleOAuthClient } from '../server/lib/googleAuth.js';
import { uploadBufferToDrive } from '../server/lib/drive.js';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

async function main() {
  const oauthClient = await getGoogleOAuthClient();
  if (!oauthClient) {
    console.error('Google Drive ist nicht verbunden (kein gespeicherter Calendar-Token gefunden). Abbruch.');
    process.exit(1);
  }

  const contracts = await prisma.contract.findMany({
    include: { document: true, customer: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`${contracts.length} bestehende Verträge gefunden. ${APPLY ? 'Lade hoch...' : 'Trockenlauf (--apply fehlt).'}`);

  for (const contract of contracts) {
    const { renderedData } = contract.document;
    const vertragsnummer = renderedData?.vertragsnummer || contract.id;
    const label = `${contract.customer.name} — ${vertragsnummer}`;

    if (!APPLY) {
      console.log(`  würde hochladen: ${label} (DOCX+PDF${DSGVO_VARIANTEN[renderedData?.dsgvoVariante]?.braucht_avv ? '+AVV' : ''})`);
      continue;
    }

    try {
      const [docxBuffer, pdfBuffer] = await Promise.all([
        buildContractDocument(renderedData),
        buildContractPdf(renderedData),
      ]);
      await uploadBufferToDrive({
        oauthClient,
        customer: contract.customer,
        filename: `${vertragsnummer}.docx`,
        buffer: docxBuffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await uploadBufferToDrive({
        oauthClient,
        customer: contract.customer,
        filename: `${vertragsnummer}.pdf`,
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      });

      const dsgvoInfo = DSGVO_VARIANTEN[renderedData?.dsgvoVariante || 'standard'];
      if (dsgvoInfo?.braucht_avv) {
        const [avvDocxBuffer, avvPdfBuffer] = await Promise.all([
          buildAvvDocument(renderedData),
          buildAvvPdf(renderedData),
        ]);
        await uploadBufferToDrive({
          oauthClient,
          customer: contract.customer,
          filename: `${vertragsnummer}-AVV.docx`,
          buffer: avvDocxBuffer,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        await uploadBufferToDrive({
          oauthClient,
          customer: contract.customer,
          filename: `${vertragsnummer}-AVV.pdf`,
          buffer: avvPdfBuffer,
          mimeType: 'application/pdf',
        });
      }
      console.log(`  ✓ hochgeladen: ${label}`);
    } catch (err) {
      console.error(`  ✗ fehlgeschlagen: ${label} — ${err?.message || err}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
