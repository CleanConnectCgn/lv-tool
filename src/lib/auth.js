// Client für /api/auth/* (Block 3).

export async function getCurrentUser() {
  const res = await fetch('/api/auth/me');
  if (res.status === 401) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Anmeldestatus konnte nicht geprüft werden');
  return data.user || null;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export const GOOGLE_LOGIN_URL = '/api/auth/google/start';
