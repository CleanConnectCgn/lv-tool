import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import express from 'express';
import request from 'supertest';
import { prisma } from './prisma.js';

let app;
let dataDir;
let customerId;
let pdfBuffer;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lv-tool-uploads-test-'));
  process.env.DATA_DIR = dataDir;
  const mod = await import('./uploads.js');
  app = express();
  app.use((req, _res, next) => {
    req.user = { id: null };
    next();
  });
  mod.registerUploadRoutes(app);

  const customer = await prisma.customer.create({ data: { name: 'Upload Test GmbH (Block 7)' } });
  customerId = customer.id;

  pdfBuffer = await fs.readFile('/tmp/test-lv.pdf').catch(() => Buffer.from('%PDF-1.3 leer'));
});

afterAll(async () => {
  await prisma.upload.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
  await fs.rm(dataDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('POST /api/db/uploads', () => {
  it('lehnt einen Upload ohne customerId/objectId ab', async () => {
    await request(app)
      .post('/api/db/uploads?mimeType=application/pdf')
      .set('Content-Type', 'application/pdf')
      .send(pdfBuffer)
      .expect(400);
  });

  it('lehnt einen Upload ohne mimeType ab', async () => {
    await request(app)
      .post(`/api/db/uploads?customerId=${customerId}`)
      .set('Content-Type', 'application/pdf')
      .send(pdfBuffer)
      .expect(400);
  });

  it('speichert die Datei und liefert ein Auslese-Ergebnis (ok oder failed, aber nie ein Absturz)', async () => {
    const res = await request(app)
      .post(`/api/db/uploads?customerId=${customerId}&mimeType=application/pdf`)
      .set('Content-Type', 'application/pdf')
      .set('X-Filename', 'test-lv.pdf')
      .send(pdfBuffer)
      .expect(201);

    expect(['ok', 'failed']).toContain(res.body.extraction.status);
    if (res.body.extraction.status === 'ok') {
      expect(Array.isArray(res.body.extraction.matched)).toBe(true);
      expect(Array.isArray(res.body.extraction.unmatched)).toBe(true);
    } else {
      expect(res.body.extraction.error).toBeTruthy();
    }

    const stored = await prisma.upload.findUnique({ where: { id: res.body.upload.id } });
    expect(stored).not.toBeNull();
    expect(stored.customerId).toBe(customerId);

    const fileOnDisk = await fs.readFile(path.join(dataDir, 'uploads', stored.fileUrl));
    expect(fileOnDisk.length).toBe(pdfBuffer.length);
  }, 120000);
});

describe('GET /api/db/uploads/:id, POST /:id/retry', () => {
  it('lädt einen bestehenden Upload erneut und kann die Auslesung wiederholen', async () => {
    const created = await request(app)
      .post(`/api/db/uploads?customerId=${customerId}&mimeType=application/pdf`)
      .set('Content-Type', 'application/pdf')
      .send(pdfBuffer)
      .expect(201);

    const fetched = await request(app).get(`/api/db/uploads/${created.body.upload.id}`).expect(200);
    expect(fetched.body.id).toBe(created.body.upload.id);

    const retried = await request(app).post(`/api/db/uploads/${created.body.upload.id}/retry`).expect(200);
    expect(['ok', 'failed']).toContain(retried.body.extraction.status);
  }, 120000);

  it('meldet 404 für einen nicht existierenden Upload', async () => {
    await request(app).get('/api/db/uploads/00000000-0000-0000-0000-000000000000').expect(404);
  });
});
