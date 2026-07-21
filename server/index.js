import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '5mb' }));

// Lets the frontend pre-fill the sevDesk token field so the user doesn't
// have to type it in manually when a server-side default is configured.
app.get('/api/sevdesk/token', (req, res) => {
  res.json({ token: process.env.SEVDESK_TOKEN || '' });
});

// Generic proxy to the sevDesk API to avoid CORS issues from the browser.
// Body: { token, method, path, body } where path is relative, e.g. "/Contact" or "/Offer".
app.post('/api/sevdesk/request', async (req, res) => {
  const { method = 'GET', path: sevPath, body } = req.body || {};
  const token = req.body?.token || process.env.SEVDESK_TOKEN;
  if (!token || !sevPath) {
    return res.status(400).json({ error: 'token und path sind erforderlich' });
  }
  try {
    const sevRes = await fetch(`https://my.sevdesk.de/api/v1${sevPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body || {}),
    });
    const data = await sevRes.json().catch(() => ({}));
    res.status(sevRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'sevDesk Anfrage fehlgeschlagen', details: String(err) });
  }
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LV-Tool server läuft auf Port ${PORT}`);
});
