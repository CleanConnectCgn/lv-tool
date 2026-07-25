// Läuft gegen die echte, per DATABASE_URL erreichbare Postgres-Instanz
// (wie server/lib/auth.test.js) - räumt alle selbst angelegten Test-
// Datensätze in afterAll wieder auf.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from './prisma.js';
import { registerDbCrmRoutes } from './dbCrm.js';

let app;
let roomAreaId;
let catalogItemId;
const customerIdsToClean = [];

beforeAll(async () => {
  app = express();
  app.use(express.json());
  registerDbCrmRoutes(app);

  const roomArea = await prisma.roomArea.findFirst();
  const catalogItem = await prisma.serviceCatalogItem.findFirst();
  roomAreaId = roomArea?.id;
  catalogItemId = catalogItem?.id;
  if (!roomAreaId || !catalogItemId) {
    throw new Error('Seed-Daten fehlen (prisma/seed.js vor den Tests ausführen)');
  }
});

afterAll(async () => {
  for (const id of customerIdsToClean) {
    await prisma.serviceSpecItem.deleteMany({ where: { serviceSpec: { object: { customerId: id } } } }).catch(() => {});
    await prisma.serviceSpec.deleteMany({ where: { object: { customerId: id } } }).catch(() => {});
    await prisma.property.deleteMany({ where: { customerId: id } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('POST /api/db/customers', () => {
  it('legt Kunde + Objekt atomar an, wenn sameAsObjectAddress gesetzt ist', async () => {
    const res = await request(app)
      .post('/api/db/customers')
      .send({ name: 'Test GmbH (Block 5)', street: 'Teststraße 1', zip: '50667', city: 'Köln', sameAsObjectAddress: true })
      .expect(201);
    customerIdsToClean.push(res.body.customer.id);

    expect(res.body.customer.name).toBe('Test GmbH (Block 5)');
    expect(res.body.object.street).toBe('Teststraße 1');
    expect(res.body.object.customerId).toBe(res.body.customer.id);

    const objects = await prisma.property.findMany({ where: { customerId: res.body.customer.id } });
    expect(objects.length).toBe(1);
  });

  it('legt KEINEN Kunden an, wenn keine Objektadresse ermittelbar ist (kein Kunde ohne Objekt)', async () => {
    const before = await prisma.customer.count();
    await request(app)
      .post('/api/db/customers')
      .send({ name: 'Sollte nicht entstehen GmbH' })
      .expect(400);
    const after = await prisma.customer.count();
    expect(after).toBe(before);
  });

  it('nutzt eine eigene Objektadresse, wenn sameAsObjectAddress nicht gesetzt ist', async () => {
    const res = await request(app)
      .post('/api/db/customers')
      .send({
        name: 'Test Filiale GmbH (Block 5)',
        street: 'Rechnungsstraße 1',
        zip: '50667',
        city: 'Köln',
        sameAsObjectAddress: false,
        firstObject: { street: 'Filialstraße 9', zip: '50668', city: 'Köln', label: 'Filiale Nord' },
      })
      .expect(201);
    customerIdsToClean.push(res.body.customer.id);
    expect(res.body.object.street).toBe('Filialstraße 9');
    expect(res.body.object.label).toBe('Filiale Nord');
  });
});

describe('POST /api/db/customers/:id/objects/bulk (Sammelanlage)', () => {
  it('erzeugt mehrere Objekte aus mehrzeiligem Text, überspringt fehlerhafte Zeilen', async () => {
    const customer = await request(app)
      .post('/api/db/customers')
      .send({ name: 'Sammel GmbH (Block 5)', street: 'A-Straße 1', zip: '50667', city: 'Köln', sameAsObjectAddress: true })
      .expect(201);
    customerIdsToClean.push(customer.body.customer.id);

    const res = await request(app)
      .post(`/api/db/customers/${customer.body.customer.id}/objects/bulk`)
      .send({ addresses: 'Musterstraße 1, 50667 Köln\nkaputte zeile ohne komma\nBeispielweg 2, 50668 Köln' })
      .expect(201);

    expect(res.body.created.length).toBe(2);
    expect(res.body.failed.length).toBe(1);
    expect(res.body.failed[0].line).toBe('kaputte zeile ohne komma');
  });
});

describe('DELETE /api/db/objects/:id', () => {
  it('verweigert das Löschen des letzten Objekts eines Kunden', async () => {
    const customer = await request(app)
      .post('/api/db/customers')
      .send({ name: 'Einzelobjekt GmbH (Block 5)', street: 'B-Straße 1', zip: '50667', city: 'Köln', sameAsObjectAddress: true })
      .expect(201);
    customerIdsToClean.push(customer.body.customer.id);

    await request(app).delete(`/api/db/objects/${customer.body.object.id}`).expect(409);
  });
});

describe('Leistungsverzeichnis erstellen + auf andere Objekte übertragen', () => {
  it('überträgt Spec+Items als unabhängige Kopien auf mehrere Ziel-Objekte', async () => {
    const customer = await request(app)
      .post('/api/db/customers')
      .send({ name: 'Transfer GmbH (Block 5)', street: 'C-Straße 1', zip: '50667', city: 'Köln', sameAsObjectAddress: true })
      .expect(201);
    customerIdsToClean.push(customer.body.customer.id);
    const sourceObjectId = customer.body.object.id;

    const bulk = await request(app)
      .post(`/api/db/customers/${customer.body.customer.id}/objects/bulk`)
      .send({ addresses: 'Zielweg 1, 50667 Köln\nZielweg 2, 50667 Köln' })
      .expect(201);
    const [target1, target2] = bulk.body.created;

    const specRes = await request(app)
      .post(`/api/db/objects/${sourceObjectId}/service-specs`)
      .send({
        leistungsart: 'Unterhaltsreinigung',
        items: [{ catalogItemId, roomAreaId, woechentlich: 2 }],
      })
      .expect(201);
    const sourceSpecId = specRes.body.id;

    const transferRes = await request(app)
      .post(`/api/db/service-specs/${sourceSpecId}/transfer`)
      .send({ targetObjectIds: [target1.id, target2.id] })
      .expect(201);

    expect(transferRes.body.createdSpecs.length).toBe(2);
    const [copy1, copy2] = transferRes.body.createdSpecs;
    expect(copy1.items[0].woechentlich).toBe(2);
    expect(copy1.id).not.toBe(copy2.id);

    // Unabhängigkeit: Änderung an einer Kopie darf die andere nicht berühren.
    await request(app)
      .put(`/api/db/service-specs/${copy1.id}/items/${copy1.items[0].id}`)
      .send({ woechentlich: 5 })
      .expect(200);

    const untouchedSpecs = await request(app).get(`/api/db/objects/${target2.id}/service-specs`).expect(200);
    expect(untouchedSpecs.body[0].items[0].woechentlich).toBe(2);
  }, 20000);
});
