// Gemeinsamer Firmenkalender-/Drive-OAuth-Client (Block 4). Extrahiert aus
// server/index.js, damit auch server/lib/documentRoutes.js und
// server/lib/customerDocuments.js denselben authentifizierten Client nutzen
// können, statt Token-Handling zu duplizieren - beide Zwecke (Kalender,
// Drive) teilen dieselbe Firmenverbindung/denselben Refresh-Token.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
export const CRM_DIR = path.join(DATA_DIR, 'crm');
export const CALENDAR_TOKEN_FILE = path.join(CRM_DIR, 'calendar-token.json');

// req ist optional: für Aufrufe außerhalb eines echten HTTP-Requests gibt es
// keinen req - dann wird Railways automatisch gesetzte RAILWAY_PUBLIC_DOMAIN
// als Fallback für die Redirect-URI verwendet. Diese wird für reine
// Token-Refreshs ohnehin nicht wirklich gebraucht, nur für den eigentlichen
// OAuth-Consent-Flow.
export function oauth2ClientFor(req) {
  const host = req ? req.get('host') : process.env.RAILWAY_PUBLIC_DOMAIN;
  const protocol = req ? req.protocol : 'https';
  const redirectUri = host ? `${protocol}://${host}/api/calendar/oauth/callback` : undefined;
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

export async function loadCalendarTokens() {
  try {
    return JSON.parse(await fs.readFile(CALENDAR_TOKEN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export async function saveCalendarTokens(tokens) {
  await fs.mkdir(CRM_DIR, { recursive: true });
  await fs.writeFile(CALENDAR_TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// Baut den rohen authentifizierten OAuth2-Client auf Basis des gespeicherten
// Refresh-Tokens (googleapis erneuert den Access-Token automatisch).
export async function getGoogleOAuthClient(req) {
  const tokens = await loadCalendarTokens();
  if (!tokens?.refresh_token) return null;
  const client = oauth2ClientFor(req);
  client.setCredentials(tokens);
  client.on('tokens', async (newTokens) => {
    await saveCalendarTokens({ ...tokens, ...newTokens });
  });
  return client;
}
