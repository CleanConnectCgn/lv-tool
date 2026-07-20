import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '5mb' }));

// Proxy to sevDesk to avoid CORS issues from the browser.
app.post('/api/sevdesk/offer', async (req, res) => {
  const { token, payload } = req.body || {};
  if (!token || !payload) {
    return res.status(400).json({ error: 'token und payload sind erforderlich' });
  }
  try {
    const sevRes = await fetch('https://my.sevdesk.de/api/v1/Offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(payload),
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
