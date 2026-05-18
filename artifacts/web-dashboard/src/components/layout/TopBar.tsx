import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTheme, toggleTheme, type Theme } from '../../shared/theme';

export default function TopBar() {
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState<Theme>(getTheme);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  function handleTheme() {
    const next = toggleTheme();
    setTheme(next);
  }

  return (
    <header
      style={{
        height: 52,
        background: 'var(--color-surf-0)',
        borderBottom: '1px solid var(--color-line-faint)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: 480, display: 'flex', gap: 8 }}>
        <input
          className="input-field"
          style={{ height: 36, padding: '0 14px', fontSize: 'var(--font-base)' }}
          placeholder="🔍 搜尋你的知識..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-primary" style={{ height: 36, padding: '0 16px', whiteSpace: 'nowrap' }} type="submit">
          搜尋
        </button>
      </form>

      {/* Theme toggle */}
      <button
        onClick={handleTheme}
        title={theme === 'dark' ? '切換亮色模式' : '切換暗色模式'}
        style={{
          background: 'var(--color-surf-2)',
          border: '1px solid var(--color-line-faint)',
          borderRadius: 8,
          width: 36,
          height: 36,
          cursor: 'pointer',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 150ms',
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  );
}
