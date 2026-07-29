// Block 3: Google OAuth als einziger Anmeldeweg. Getrennt von der
// bestehenden Kalender-Verbindung (oauth2ClientFor/CALENDAR_TOKEN_FILE in
// server/index.js) - das ist die EINE geteilte Firmenkalender-Anbindung und
// bleibt unverändert. Hier geht es um die Anmeldung einzelner Personen.
import crypto from 'crypto';
import cookie from 'cookie';
import { google } from 'googleapis';
import { prisma } from './prisma.js';
import { encryptToken } from './crypto.js';

export const SESSION_COOKIE_NAME = 'lv_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

// openid ergänzt (nicht im Auftragstext explizit genannt) - liefert ein
// verifizierbares ID-Token mit der E-Mail-Adresse, technische Notwendigkeit
// für eine korrekte OAuth-Anmeldung, kein zusätzlicher Datenzugriff.
const LOGIN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar',
];

function loginOAuth2ClientFor(req) {
  const host = req.get('host');
  const protocol = req.protocol;
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

function allowedEmailSet() {
  return new Set(
    (process.env.ALLOWED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isEmailAllowed(email) {
  if (!email) return false;
  return allowedEmailSet().has(email.toLowerCase());
}

function sign(payloadB64) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET ist nicht konfiguriert');
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function signSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE_MS })).toString(
    'base64url'
  );
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
  if (!data?.uid || !data?.exp || Date.now() > data.exp) return null;
  return data;
}

function setSessionCookie(res, userId) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(SESSION_COOKIE_NAME, signSessionToken(userId), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS / 1000,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(SESSION_COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  );
}

// Liest die Session, verifiziert die Signatur, lädt den User UND prüft
// ALLOWED_EMAILS bei JEDER Anfrage neu (nicht nur beim Login) - so wirkt ein
// Entzug des Zugangs (E-Mail aus ALLOWED_EMAILS entfernen) sofort, ohne dass
// die 30-tägige Session erst ablaufen muss.
export async function getSessionUser(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const payload = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user || !isEmailAllowed(user.email)) return null;
  return user;
}

// Gate für /api/* (außer /api/auth/*, siehe server/index.js Registrierungsreihenfolge).
export async function requireAuth(req, res, next) {
  // Nur für den bestehenden Endpoint-Testsuite (server/index.test.js), die
  // die dateibasierten CRUD-Endpoints ohne laufende Postgres-Instanz prüft -
  // wird ausschließlich dort per Env-Variable gesetzt, niemals in .env.example
  // dokumentiert oder produktiv verwendet.
  if (process.env.DISABLE_AUTH_FOR_TESTS === '1') {
    req.user = { id: 'test-user', email: 'test@example.com', role: 'ADMIN' };
    return next();
  }
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Nicht angemeldet' });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Anmeldeprüfung fehlgeschlagen' });
  }
}

// Für die wenigen Routen, die absichtlich nicht jedem Mitarbeiter offen
// stehen sollen (z.B. kompletter Datenexport) - im Gegensatz zum
// gewöhnlichen Tagesgeschäft (Kunden/Objekte/Verträge), das laut Auftrag
// bewusst für alle Mitarbeiter sichtbar bleibt (kleines Team, keine
// Owner-basierte Trennung gewünscht). Muss NACH requireAuth registriert
// werden, setzt also req.user voraus.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }
  next();
}

export function registerAuthRoutes(app) {
  app.get('/api/auth/google/start', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).send('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET sind nicht konfiguriert.');
    }
    const client = loginOAuth2ClientFor(req);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: LOGIN_SCOPES,
    });
    res.redirect(url);
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const client = loginOAuth2ClientFor(req);
      const { tokens } = await client.getToken(req.query.code);
      client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const { data: profile } = await oauth2.userinfo.get();
      const email = (profile.email || '').toLowerCase();

      // Abgelehnte Anmeldung zeigt eine klare Meldung, keinen Fehlercode -
      // die SPA übernimmt das Rendern (siehe AuthGate.jsx), hier nur ein
      // sprechendes Query-Flag statt eines rohen 401/403.
      if (!isEmailAllowed(email)) {
        return res.redirect('/?auth=denied');
      }

      const existing = await prisma.user.findUnique({ where: { googleId: profile.id } });
      const data = {
        email,
        name: profile.name || null,
        pictureUrl: profile.picture || null,
        accessTokenEnc: tokens.access_token ? encryptToken(tokens.access_token) : existing?.accessTokenEnc || null,
        // Google liefert ein refresh_token nur beim ERSTEN Consent - danach
        // den vorhandenen behalten statt ihn zu überschreiben (sonst geht er
        // bei jedem erneuten Login verloren).
        refreshTokenEnc: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : existing?.refreshTokenEnc || null,
      };

      const user = existing
        ? await prisma.user.update({ where: { id: existing.id }, data })
        : await prisma.user.create({ data: { ...data, googleId: profile.id } });

      setSessionCookie(res, user.id);
      res.redirect('/');
    } catch (err) {
      res.status(500).send(`Anmeldung fehlgeschlagen: ${err?.message || err}`);
    }
  });

  // Bewusst NICHT hinter requireAuth - liefert 401 mit user:null statt einer
  // Weiterleitung, damit die SPA beim Laden einfach prüfen kann "bin ich
  // angemeldet?", ohne dass das wie ein echter Fehler behandelt wird.
  app.get('/api/auth/me', async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ user: null });
    res.json({ user: { id: user.id, email: user.email, name: user.name, pictureUrl: user.pictureUrl, role: user.role } });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
  });
}
