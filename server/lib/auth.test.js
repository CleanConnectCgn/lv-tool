// Braucht eine erreichbare Postgres-Instanz (DATABASE_URL) - getSessionUser
// prüft echte User-Datensätze, damit der Realtime-Entzug über ALLOWED_EMAILS
// (siehe auth.js) tatsächlich gegen die DB getestet wird, nicht nur gegen
// eine Mock-Annahme. Läuft lokal wie jeder andere DATABASE_URL-Verbraucher.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { prisma } from './prisma.js';

const TEST_EMAIL = 'auth-test-user@example.com';
let isEmailAllowed, requireAuth, createdUserId;

beforeAll(async () => {
  process.env.SESSION_SECRET = 'test-secret-nicht-fuer-produktion';
  process.env.ALLOWED_EMAILS = TEST_EMAIL;
  delete process.env.DISABLE_AUTH_FOR_TESTS;
  const mod = await import('./auth.js');
  isEmailAllowed = mod.isEmailAllowed;
  requireAuth = mod.requireAuth;

  const user = await prisma.user.create({
    data: { googleId: `test-google-id-${crypto.randomUUID()}`, email: TEST_EMAIL, name: 'Auth Test' },
  });
  createdUserId = user.id;
});

afterAll(async () => {
  if (createdUserId) await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
  await prisma.$disconnect();
});

function signSessionToken(uid, secret) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 60_000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

describe('isEmailAllowed', () => {
  it('erlaubt E-Mails aus ALLOWED_EMAILS unabhängig von Groß-/Kleinschreibung', () => {
    expect(isEmailAllowed(TEST_EMAIL)).toBe(true);
    expect(isEmailAllowed(TEST_EMAIL.toUpperCase())).toBe(true);
  });

  it('lehnt E-Mails ab, die nicht in ALLOWED_EMAILS stehen', () => {
    expect(isEmailAllowed('jemand-anderes@example.com')).toBe(false);
    expect(isEmailAllowed('')).toBe(false);
    expect(isEmailAllowed(null)).toBe(false);
  });
});

describe('requireAuth (Middleware-Verhalten via supertest)', () => {
  function buildApp() {
    const app = express();
    app.get('/geschuetzt', requireAuth, (req, res) => res.json({ ok: true, email: req.user.email }));
    return app;
  }

  it('lehnt Anfragen ohne Session-Cookie mit 401 ab', async () => {
    await request(buildApp()).get('/geschuetzt').expect(401);
  });

  it('lehnt eine manipulierte Signatur ab', async () => {
    const token = signSessionToken(createdUserId, 'falsches-secret');
    await request(buildApp()).get('/geschuetzt').set('Cookie', `lv_session=${token}`).expect(401);
  });

  it('lehnt ein abgelaufenes Token ab', async () => {
    const payload = Buffer.from(JSON.stringify({ uid: createdUserId, exp: Date.now() - 1000 })).toString(
      'base64url'
    );
    const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
    await request(buildApp())
      .get('/geschuetzt')
      .set('Cookie', `lv_session=${payload}.${sig}`)
      .expect(401);
  });

  it('lässt eine gültige Session für eine erlaubte E-Mail durch', async () => {
    const token = signSessionToken(createdUserId, process.env.SESSION_SECRET);
    const res = await request(buildApp()).get('/geschuetzt').set('Cookie', `lv_session=${token}`).expect(200);
    expect(res.body).toEqual({ ok: true, email: TEST_EMAIL });
  });

  it('entzieht den Zugang in Echtzeit, sobald die E-Mail aus ALLOWED_EMAILS entfernt wird', async () => {
    const token = signSessionToken(createdUserId, process.env.SESSION_SECRET);
    process.env.ALLOWED_EMAILS = 'jemand-ganz-anderes@example.com';
    try {
      await request(buildApp()).get('/geschuetzt').set('Cookie', `lv_session=${token}`).expect(401);
    } finally {
      process.env.ALLOWED_EMAILS = TEST_EMAIL;
    }
  });
});
