// Thin client for the local /api/documents backend, which persists
// LVs/Angebote as JSON files on the server (see server/index.js).

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Fehler (${res.status})`);
  }
  return data;
}

export function listDocuments() {
  return request('GET', '/api/documents');
}

export function getDocument(id) {
  return request('GET', `/api/documents/${id}`);
}

export function createDocument(doc) {
  return request('POST', '/api/documents', doc);
}

export function updateDocument(id, doc) {
  return request('PUT', `/api/documents/${id}`, doc);
}

export function deleteDocument(id) {
  return request('DELETE', `/api/documents/${id}`);
}
