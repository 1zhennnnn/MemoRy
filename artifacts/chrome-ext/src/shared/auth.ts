import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./constants.js";

const TOKEN_KEY   = "memory_auth_token";
const REFRESH_KEY = "memory_refresh_token";

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return (result[TOKEN_KEY] as string | undefined) ?? null;
}

export async function setToken(accessToken: string, refreshToken: string): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]:   accessToken,
    [REFRESH_KEY]: refreshToken,
  });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, REFRESH_KEY]);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const decoded = JSON.parse(atob(parts[1]!)) as { exp?: number };
    return (decoded.exp ?? 0) * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function loginWithGoogle(): Promise<void> {
  const redirectUrl = chrome.identity.getRedirectURL("auth");
  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectUrl);
  authUrl.searchParams.set("response_type", "token");

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) throw new Error("OAuth 取消");

  const url = new URL(responseUrl);
  const params = new URLSearchParams(url.hash.slice(1));
  const accessToken  = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken) throw new Error("未收到 access_token");
  await setToken(accessToken, refreshToken ?? "");
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error_description?: string };
    throw new Error(err.error_description ?? "登入失敗");
  }

  const data = (await res.json()) as { access_token: string; refresh_token: string };
  await setToken(data.access_token, data.refresh_token);
}

export async function refreshTokenIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get([TOKEN_KEY, REFRESH_KEY]);
  const token        = result[TOKEN_KEY] as string | undefined;
  const refreshToken = result[REFRESH_KEY] as string | undefined;

  if (!token || !refreshToken) return;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return;
    const { exp } = JSON.parse(atob(parts[1]!)) as { exp?: number };
    if ((exp ?? 0) * 1000 - Date.now() > 5 * 60 * 1000) return;
  } catch {
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (res.ok) {
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    await setToken(data.access_token, data.refresh_token);
  }
}
