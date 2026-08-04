// Client für /api/db/* (Block 5 - Kundenmaske/Objekte gegen die neue
// Postgres-Datenbank, siehe server/lib/dbCrm.js). Bewusst getrennt von
// src/lib/crm.js (dateibasiertes CRM, bleibt bis Block 9 unverändert).

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

export const listDbCustomers = () => request('GET', '/api/db/customers');
export const getDbCustomer = (id) => request('GET', `/api/db/customers/${id}`);
export const createDbCustomer = (payload) => request('POST', '/api/db/customers', payload);
export const updateDbCustomer = (id, patch) => request('PUT', `/api/db/customers/${id}`, patch);

export const listDbObjects = (customerId) =>
  request('GET', `/api/db/objects${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`);
export const getDbObject = (id) => request('GET', `/api/db/objects/${id}`);
export const createDbObject = (payload) => request('POST', '/api/db/objects', payload);
export const updateDbObject = (id, patch) => request('PUT', `/api/db/objects/${id}`, patch);
export const deleteDbObject = (id) => request('DELETE', `/api/db/objects/${id}`);
export const bulkCreateDbObjects = (customerId, addresses) =>
  request('POST', `/api/db/customers/${customerId}/objects/bulk`, { addresses });

export const listRoomAreas = () => request('GET', '/api/db/room-areas');
export const listElementGroups = () => request('GET', '/api/db/element-groups');
export const listCatalog = (elementGroupId) =>
  request('GET', `/api/db/catalog${elementGroupId ? `?elementGroupId=${encodeURIComponent(elementGroupId)}` : ''}`);
export const createCatalogItem = (payload) => request('POST', '/api/db/catalog', payload);

export const listServiceSpecs = (objectId) => request('GET', `/api/db/objects/${objectId}/service-specs`);
export const createServiceSpec = (objectId, payload) =>
  request('POST', `/api/db/objects/${objectId}/service-specs`, payload);
export const updateServiceSpecItem = (specId, itemId, patch) =>
  request('PUT', `/api/db/service-specs/${specId}/items/${itemId}`, patch);
export const transferServiceSpec = (specId, targetObjectIds) =>
  request('POST', `/api/db/service-specs/${specId}/transfer`, { targetObjectIds });

// Block 6: sevDesk-Kundenverknüpfung
export const runSevdeskLink = () => request('POST', '/api/db/sevdesk-link/run');
export const confirmSevdeskLink = (customerId, sevdeskContactId) =>
  request('POST', '/api/db/sevdesk-link/confirm', { customerId, sevdeskContactId });
export const unlinkSevdesk = (customerId) => request('DELETE', `/api/db/sevdesk-link/${customerId}`);

// Block 7: Upload und Auslesung (raw-binary Body, nicht JSON).
export async function uploadDocumentForExtraction(file, { customerId, objectId }) {
  const params = new URLSearchParams({ mimeType: file.type });
  if (customerId) params.set('customerId', customerId);
  if (objectId) params.set('objectId', objectId);
  const res = await fetch(`/api/db/uploads?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) },
    body: await file.arrayBuffer(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Fehler (${res.status})`);
  return data;
}
export const getUpload = (id) => request('GET', `/api/db/uploads/${id}`);
export const retryUpload = (id) => request('POST', `/api/db/uploads/${id}/retry`);
export const listUploads = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/api/db/uploads${qs ? `?${qs}` : ''}`);
};

// Block 8: Dokumentenausgabe
export const lvPdfUrl = (specIds) => `/api/db/lv-pdf?specIds=${specIds.join(',')}`;
export const createContract = (objectId, payload) => request('POST', `/api/db/objects/${objectId}/contract`, payload);
export const contractDocxUrl = (contractId) => `/api/db/contracts/${contractId}/docx`;
export const contractPdfUrl = (contractId) => `/api/db/contracts/${contractId}/pdf`;
export const listContracts = (customerId) => request('GET', `/api/db/contracts?customerId=${customerId}`);

// Baustein-System: AVV (Anlage 3), Status-Historie, KI-Gegenkontrolle.
export const avvDocxUrl = (contractId) => `/api/db/contracts/${contractId}/avv-docx`;
export const avvPdfUrl = (contractId) => `/api/db/contracts/${contractId}/avv-pdf`;
export const updateContractStatus = (contractId, status) =>
  request('PATCH', `/api/db/contracts/${contractId}/status`, { status });
export const runContractAiReview = (contractId) => request('POST', `/api/db/contracts/${contractId}/ai-review`);

// Google-Drive-Kundenordner: Verträge/LVs/Angebote landen automatisch dort
// (documentRoutes.js), Scans (Schlüsselübergabeprotokolle etc.) über diesen
// manuellen Upload (raw-binary Body, wie uploadDocumentForExtraction oben).
export const listCustomerDocuments = (customerId) => request('GET', `/api/db/customers/${customerId}/documents`);
export async function uploadCustomerDocument(customerId, file) {
  const res = await fetch(`/api/db/customers/${customerId}/documents?mimeType=${encodeURIComponent(file.type)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) },
    body: await file.arrayBuffer(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Fehler (${res.status})`);
  return data;
}
