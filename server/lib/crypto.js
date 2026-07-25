// Verschlüsselt die Google-Access-/Refresh-Tokens vor der Ablage in
// users.access_token_enc / users.refresh_token_enc (AES-256-GCM). Der
// Schlüssel TOKEN_ENCRYPTION_KEY ist ein 32-Byte-Wert, base64-kodiert in der
// Env-Variable (z.B. `openssl rand -base64 32` erzeugen).
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function loadKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY muss 32 Bytes (base64-kodiert) lang sein');
  }
  return key;
}

// Format: base64(iv).base64(authTag).base64(ciphertext) - alles in einem
// String speicherbar, ohne Trennzeichen-Kollisionsrisiko dank fixer iv/tag-Länge.
export function encryptToken(plainText) {
  if (!plainText) return null;
  const key = loadKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY ist nicht konfiguriert');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptToken(stored) {
  if (!stored) return null;
  const key = loadKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY ist nicht konfiguriert');
  const [ivB64, tagB64, dataB64] = stored.split('.');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plain.toString('utf-8');
}
