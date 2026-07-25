// Geteiltes Mail-Modul (Gmail SMTP über nodemailer). Genutzt vom Web-Server
// (täglicher Erinnerungs-Digest) UND vom Backup-Worker (Fehlschlag-Mail,
// Block 4) - beides sind getrennte Prozesse, daher hier zentral statt in
// server/index.js dupliziert.
import nodemailer from 'nodemailer';

export function mailTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

// Kein-Op, wenn SMTP nicht konfiguriert ist (siehe .env.example) - ruft
// mailTransporter() jedes Mal frisch auf statt zu cachen, da Env-Variablen
// sich zwischen Prozessstarts ändern können.
export async function sendOperatorMail({ subject, text }) {
  const transporter = mailTransporter();
  if (!transporter) return { sent: false, reason: 'not_configured' };
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text });
  return { sent: true };
}
