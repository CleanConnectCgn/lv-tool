import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from './prisma.js';
import { registerDocumentRoutes } from './documentRoutes.js';

let app;
let customerId;
let objectId;
let roomAreaId;
let catalogItemId;
let specId;
const contractIdsToClean = [];

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: null };
    next();
  });
  registerDocumentRoutes(app);

  const roomArea = await prisma.roomArea.findFirst();
  const catalogItem = await prisma.serviceCatalogItem.findFirst();
  roomAreaId = roomArea.id;
  catalogItemId = catalogItem.id;

  const customer = await prisma.customer.create({
    data: {
      name: 'Dokument Test GmbH (Block 8)',
      street: 'Dokumentweg 1',
      zip: '50667',
      city: 'Köln',
      contactPerson: 'Frau Test',
      objects: { create: { street: 'Dokumentweg 1', zip: '50667', city: 'Köln', label: 'Hauptsitz' } },
    },
    include: { objects: true },
  });
  customerId = customer.id;
  objectId = customer.objects[0].id;

  const spec = await prisma.serviceSpec.create({
    data: {
      objectId,
      leistungsart: 'Unterhaltsreinigung',
      standDatum: new Date('2026-07-01'),
      items: { create: [{ catalogItemId, roomAreaId, woechentlich: 2, bemerkung: 'Testbemerkung' }] },
    },
  });
  specId = spec.id;
});

afterAll(async () => {
  for (const id of contractIdsToClean) {
    await prisma.contract.delete({ where: { id } }).catch(() => {});
  }
  await prisma.document.deleteMany({ where: { customerId } });
  await prisma.serviceSpecItem.deleteMany({ where: { serviceSpecId: specId } });
  await prisma.serviceSpec.delete({ where: { id: specId } }).catch(() => {});
  await prisma.property.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('GET /api/db/lv-pdf', () => {
  it('lehnt eine Anfrage ohne specIds ab', async () => {
    await request(app).get('/api/db/lv-pdf').expect(400);
  });

  it('rendert ein echtes PDF für einen gültigen ServiceSpec', async () => {
    const res = await request(app).get(`/api/db/lv-pdf?specIds=${specId}`).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.toString('latin1', 0, 8)).toBe('%PDF-1.3');
  });

  it('meldet 404 für unbekannte specIds', async () => {
    await request(app).get('/api/db/lv-pdf?specIds=00000000-0000-0000-0000-000000000000').expect(404);
  });
});

describe('POST /api/db/objects/:id/contract, GET /api/db/contracts/:id/docx', () => {
  it('legt Document + Contract an und generiert bei Abruf ein echtes DOCX', async () => {
    const created = await request(app)
      .post(`/api/db/objects/${objectId}/contract`)
      .send({
        leistungsart: 'Unterhaltsreinigung',
        reinigungsintervall: '2x wöchentlich',
        verguetungNetto: 450,
        vertragsbeginn: '2026-09-01',
        internerAnsprechpartner: 'Julian Mühlhoff',
        lvDatum: '2026-07-01',
      })
      .expect(201);
    contractIdsToClean.push(created.body.contract.id);

    expect(created.body.document.type).toBe('VERTRAG');
    expect(created.body.document.renderedData.vertragsnummer).toMatch(/^VT-\d{4}$/);
    expect(created.body.document.renderedData.kunde.firma).toBe('Dokument Test GmbH (Block 8)');

    // supertest puffert diesen MIME-Type nicht automatisch in .body - über
    // Content-Length statt res.body.length prüfen, dass echte Bytes zurückkamen.
    const docxRes = await request(app)
      .get(`/api/db/contracts/${created.body.contract.id}/docx`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(docxRes.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(docxRes.body.length).toBeGreaterThan(0);
    // Ein echtes DOCX ist ein ZIP-Archiv (Signatur "PK").
    expect(docxRes.body.toString('latin1', 0, 2)).toBe('PK');
  });

  it('erzeugt bei zwei Verträgen zwei unterschiedliche Vertragsnummern', async () => {
    const a = await request(app).post(`/api/db/objects/${objectId}/contract`).send({}).expect(201);
    const b = await request(app).post(`/api/db/objects/${objectId}/contract`).send({}).expect(201);
    contractIdsToClean.push(a.body.contract.id, b.body.contract.id);
    expect(a.body.document.renderedData.vertragsnummer).not.toBe(b.body.document.renderedData.vertragsnummer);
  });

  it('listet Verträge eines Kunden', async () => {
    const list = await request(app).get(`/api/db/contracts?customerId=${customerId}`).expect(200);
    expect(list.body.length).toBeGreaterThan(0);
  });
});
