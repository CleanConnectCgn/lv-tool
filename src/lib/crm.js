// Thin client für die CRM- und Kalender-Endpoints (siehe server/index.js).

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const err = new Error(data?.error || `Fehler (${res.status})`);
    if (data?.reconnectRequired) err.reconnectRequired = true;
    throw err;
  }
  return data;
}

export const listCustomers = () => request('GET', '/api/crm/customers');
export const getCustomer = (key) => request('GET', `/api/crm/customers/${encodeURIComponent(key)}`);
export const saveCustomerNotes = (key, notizen) => request('PUT', `/api/crm/customers/${encodeURIComponent(key)}`, { notizen });
export const mergeCustomer = (sourceKey, targetKey) =>
  request('POST', `/api/crm/customers/${encodeURIComponent(sourceKey)}/merge`, { targetKey });

export const listAuftraege = () => request('GET', '/api/crm/auftraege');
export const createAuftrag = (auftrag) => request('POST', '/api/crm/auftraege', auftrag);
export const updateAuftrag = (id, patch) => request('PUT', `/api/crm/auftraege/${id}`, patch);
export const deleteAuftrag = (id) => request('DELETE', `/api/crm/auftraege/${id}`);

export const listMitarbeiter = () => request('GET', '/api/crm/mitarbeiter');
export const createMitarbeiter = (m) => request('POST', '/api/crm/mitarbeiter', m);
export const updateMitarbeiter = (id, patch) => request('PUT', `/api/crm/mitarbeiter/${id}`, patch);
export const deleteMitarbeiter = (id) => request('DELETE', `/api/crm/mitarbeiter/${id}`);

export const listObjekte = (customerKey) =>
  request('GET', `/api/crm/objekte${customerKey ? `?customerKey=${encodeURIComponent(customerKey)}` : ''}`);
export const createObjekt = (o) => request('POST', '/api/crm/objekte', o);
export const updateObjekt = (id, patch) => request('PUT', `/api/crm/objekte/${id}`, patch);
export const deleteObjekt = (id) => request('DELETE', `/api/crm/objekte/${id}`);

export const getCalendarStatus = () => request('GET', '/api/calendar/status');
export const disconnectCalendar = () => request('POST', '/api/calendar/disconnect');
export const listCalendarEvents = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/api/calendar/events${qs ? `?${qs}` : ''}`);
};
export const createCalendarEvent = (event) => request('POST', '/api/calendar/events', event);
export const updateCalendarEvent = (id, patch) => request('PUT', `/api/calendar/events/${id}`, patch);
export const deleteCalendarEvent = (id) => request('DELETE', `/api/calendar/events/${id}`);
