// Thin client für die CRM- und Kalender-Endpoints (siehe server/index.js).

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

export const listCustomers = () => request('GET', '/api/crm/customers');
export const getCustomer = (key) => request('GET', `/api/crm/customers/${encodeURIComponent(key)}`);
export const saveCustomerNotes = (key, notizen) => request('PUT', `/api/crm/customers/${encodeURIComponent(key)}`, { notizen });

export const listAuftraege = () => request('GET', '/api/crm/auftraege');
export const createAuftrag = (auftrag) => request('POST', '/api/crm/auftraege', auftrag);
export const updateAuftrag = (id, patch) => request('PUT', `/api/crm/auftraege/${id}`, patch);
export const deleteAuftrag = (id) => request('DELETE', `/api/crm/auftraege/${id}`);

export const getCalendarStatus = () => request('GET', '/api/calendar/status');
export const listCalendarEvents = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/api/calendar/events${qs ? `?${qs}` : ''}`);
};
export const createCalendarEvent = (event) => request('POST', '/api/calendar/events', event);
export const updateCalendarEvent = (id, patch) => request('PUT', `/api/calendar/events/${id}`, patch);
export const deleteCalendarEvent = (id) => request('DELETE', `/api/calendar/events/${id}`);
