import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import request from 'supertest';

// DATA_DIR muss gesetzt sein, bevor server/index.js importiert wird, da die
// Verzeichnis-Konstanten dort beim Modul-Import einmalig ausgewertet werden.
let app;
let dataDir;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lv-tool-test-'));
  process.env.DATA_DIR = dataDir;
  const mod = await import('./index.js');
  app = mod.default;
});

describe('POST /api/crm/customers/:key/merge', () => {
  it('moves documents and auftraege from source to target customer, keeps both notes', async () => {
    const docA = await request(app)
      .post('/api/documents')
      .send({ lvTitle: 'LV A', objekt: 'Objekt A', customer: { name: 'Merge Ziel Kunde' } })
      .expect(201);
    const docB = await request(app)
      .post('/api/documents')
      .send({ lvTitle: 'LV B', objekt: 'Objekt B', customer: { name: 'Merge Quell Kunde' } })
      .expect(201);

    const targetKey = 'name-merge-ziel-kunde';
    const sourceKey = 'name-merge-quell-kunde';

    const auftrag = await request(app)
      .post('/api/crm/auftraege')
      .send({ customerKey: sourceKey, customerName: 'Merge Quell Kunde', titel: 'Test-Auftrag' })
      .expect(201);

    await request(app).put(`/api/crm/customers/${sourceKey}`).send({ notizen: 'Quell-Notiz' }).expect(200);
    await request(app).put(`/api/crm/customers/${targetKey}`).send({ notizen: 'Ziel-Notiz' }).expect(200);

    await request(app)
      .post(`/api/crm/customers/${sourceKey}/merge`)
      .send({ targetKey })
      .expect(200);

    const targetProfile = await request(app).get(`/api/crm/customers/${targetKey}`).expect(200);
    const docIds = targetProfile.body.documents.map((d) => d.id);
    expect(docIds).toContain(docA.body.id);
    expect(docIds).toContain(docB.body.id);
    expect(targetProfile.body.auftraege.some((a) => a.id === auftrag.body.id)).toBe(true);
    expect(targetProfile.body.notizen).toContain('Ziel-Notiz');
    expect(targetProfile.body.notizen).toContain('Quell-Notiz');

    // Quell-Kunde existiert danach nicht mehr eigenständig (alle Dokumente umgeschrieben).
    const afterMerge = await request(app).get(`/api/crm/customers/${sourceKey}`);
    expect(afterMerge.status).toBe(404);
  });

  it('returns 400 when targetKey is missing', async () => {
    const res = await request(app).post('/api/crm/customers/some-key/merge').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when the target customer does not exist', async () => {
    const res = await request(app)
      .post('/api/crm/customers/name-nonexistent-source/merge')
      .send({ targetKey: 'name-nonexistent-target' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/calendar/disconnect', () => {
  it('removes a stored refresh token so status reports disconnected', async () => {
    const crmDir = path.join(dataDir, 'crm');
    await fs.mkdir(crmDir, { recursive: true });
    await fs.writeFile(path.join(crmDir, 'calendar-token.json'), JSON.stringify({ refresh_token: 'fake-token' }));

    const before = await request(app).get('/api/calendar/status').expect(200);
    expect(before.body.connected).toBe(true);

    await request(app).post('/api/calendar/disconnect').expect(200);

    const after = await request(app).get('/api/calendar/status').expect(200);
    expect(after.body.connected).toBe(false);
  });

  it('is idempotent when no token file exists', async () => {
    await request(app).post('/api/calendar/disconnect').expect(200);
    await request(app).post('/api/calendar/disconnect').expect(200);
  });
});
