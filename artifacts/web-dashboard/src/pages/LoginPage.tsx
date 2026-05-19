import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmail, loginWithGoogle, setAuthData } from '../shared/auth';
import Spinner from '../components/common/Spinner';

async function signupWithEmail(email: string, password: string): Promise<void> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { msg?: string; message?: string };
    throw new Error(err.msg ?? err.message ?? '註冊失敗');
  }

  const data = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    user?: { email?: string };
  };

  if (data.access_token && data.refresh_token) {
    setAuthData({ accessToken: data.access_token, refreshToken: data.refresh_token, email: data.user?.email ?? email });
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup' && password !== confirm) {
      setError('兩次密碼不一致');
      return;
    }
    if (password.length < 6) {
      setError('密碼至少 6 個字元');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        navigate('/');
      } else {
        await signupWithEmail(email, password);
        // Supabase may require email confirmation
        setInfo('✓ 註冊成功！請檢查信箱確認後再登入（或直接試試登入）');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? '登入失敗' : '註冊失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--color-void)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 360,
          background: 'var(--color-surf-1)',
          border: '1px solid var(--color-line-faint)',
          borderRadius: 'var(--radius-popup)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="MemoRy" style={{ width: 200, height: 132, objectFit: 'contain', marginBottom: 4 }} />
          <div style={{ fontSize: 12, color: 'var(--color-text-lo)', marginTop: 4 }}>
            AI 碎片化知識管理系統
          </div>
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--color-surf-2)',
            borderRadius: 'var(--radius-input)',
            padding: 3,
          }}
        >
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setInfo(''); }}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: 'var(--radius-input)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms',
                background: mode === m ? 'var(--color-signal)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--color-text-lo)',
              }}
            >
              {m === 'login' ? '登入' : '註冊'}
            </button>
          ))}
        </div>

        {/* Google */}
        <button
          className="btn-ghost"
          style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={loginWithGoogle}
        >
          <span style={{ fontWeight: 700, fontFamily: 'sans-serif' }}>G</span>
          使用 Google {mode === 'login' ? '登入' : '註冊'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <hr className="sep" style={{ flex: 1, margin: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-lo)' }}>或</span>
          <hr className="sep" style={{ flex: 1, margin: 0 }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="input-field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            className="input-field"
            type="password"
            placeholder="密碼（至少 6 字元）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'signup' && (
            <input
              className="input-field"
              type="password"
              placeholder="確認密碼"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--color-failed)', textAlign: 'center', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ fontSize: 12, color: 'var(--color-done)', textAlign: 'center', lineHeight: 1.5 }}>
              {info}
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? <Spinner size={16} color="#fff" /> : mode === 'login' ? '登入' : '建立帳號'}
          </button>
        </form>
      </div>
    </div>
  );
}
