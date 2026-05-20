const STORAGE_KEY = 'memory_auth';

interface AuthData {
  accessToken: string;
  refreshToken: string;
  email: string;
}

export function getAuthData(): AuthData | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthData; } catch { return null; }
}

export function setAuthData(data: AuthData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getAuthData()?.accessToken ?? null;
}

export function getUserEmail(): string | null {
  return getAuthData()?.email ?? null;
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    throw new Error(err.error_description ?? '登入失敗');
  }

  const data = await res.json() as { access_token: string; refresh_token: string; user: { email: string } };
  setAuthData({ accessToken: data.access_token, refreshToken: data.refresh_token, email: data.user.email });
}

export function loginWithGoogle(): void {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const redirectTo = `${window.location.origin}/`;
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export async function refreshAccessToken(): Promise<boolean> {
  const data = getAuthData();
  if (!data?.refreshToken) return false;
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: data.refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json() as { access_token?: string; refresh_token?: string };
    if (!json.access_token) return false;
    setAuthData({
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? data.refreshToken,
      email: data.email,
    });
    return true;
  } catch {
    return false;
  }
}

export function logout(): void {
  clearAuthData();
  window.location.replace('/login');
}

export function parseOAuthHash(): boolean {
  if (!window.location.hash.includes('access_token=')) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return false;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1])) as { email?: string };
    setAuthData({ accessToken, refreshToken, email: payload.email ?? '' });
  } catch {
    setAuthData({ accessToken, refreshToken, email: '' });
  }
  return true;
}
