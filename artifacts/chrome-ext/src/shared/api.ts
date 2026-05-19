import { API_BASE_URL } from "./constants.js";

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const bodyStr = JSON.stringify(body);
  // keepalive has a 64KB body limit in Chrome — disable for large payloads (e.g. screenshots)
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body: bodyStr,
    keepalive: bodyStr.length < 60_000,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg = (err as { error?: { message?: string } }).error?.message ?? `API error: ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
