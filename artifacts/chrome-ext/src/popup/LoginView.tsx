import React, { useState } from "react";
import type { Message } from "../shared/types.js";

interface LoginViewProps {
  onLogin: () => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true); setError(null);
    try {
      const msg: Message = { type: "LOGIN_GOOGLE" };
      const res = await chrome.runtime.sendMessage(msg) as { error?: string } | undefined;
      if (res?.error) throw new Error(res.error);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true); setError(null);
    try {
      const msg: Message = { type: "LOGIN_EMAIL", payload: { email, password } };
      const res = await chrome.runtime.sendMessage(msg) as { error?: string } | undefined;
      if (res?.error) throw new Error(res.error);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "#161A28",
    border: "1px solid #2A3555", borderRadius: "6px", color: "#DFE4F0",
    fontSize: "13px", outline: "none",
  };

  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <img src="icons/icon48.png" alt="MemoRy" style={{ width: 120, height: 66, objectFit: "contain" }} />
        <div style={{ fontSize: "12px", color: "#8A96B2", marginTop: "6px" }}>AI 知識管理</div>
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        style={{
          width: "100%", padding: "10px", background: "#1A2035",
          border: "1px solid #2A3555", borderRadius: "8px", color: "#DFE4F0",
          fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", gap: "8px",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        使用 Google 登入
      </button>

      <div style={{ textAlign: "center", color: "#4A5272", fontSize: "11px" }}>或</div>

      <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={input} type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "9px", background: "#5B7AE0",
            border: "none", borderRadius: "7px", color: "#fff",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}
        >
          {loading ? "登入中…" : "登入"}
        </button>
      </form>

      {error && <div style={{ color: "#F05068", fontSize: "12px", textAlign: "center" }}>{error}</div>}
    </div>
  );
}
