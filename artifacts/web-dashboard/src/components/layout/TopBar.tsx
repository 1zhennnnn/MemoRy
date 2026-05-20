import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTheme, toggleTheme, type Theme } from '../../shared/theme';
import Icon from '../common/Icon';

type Mode = 'semantic' | 'keyword';

export default function TopBar() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Mode>('semantic');
  const [theme, setTheme] = useState<Theme>(getTheme);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}&mode=${mode}`);
  }

  return (
    <header style={{
      height: 52,
      background: 'var(--color-surf-0)',
      borderBottom: '1px solid var(--color-line-faint)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 12,
      flexShrink: 0,
    }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: 540, display: 'flex', gap: 0 }}>
        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          height: 36, boxSizing: 'border-box',
          background: 'var(--color-surf-2)',
          border: '1px solid var(--color-line-faint)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {(['semantic', 'keyword'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                padding: '0 10px',
                height: '100%',
                border: 'none',
                borderRight: '1px solid var(--color-line-faint)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                background: mode === m ? 'var(--color-signal-dim)' : 'transparent',
                color: mode === m ? 'var(--color-signal-light)' : 'var(--color-text-lo)',
              }}
            >
              {m === 'semantic' ? 'AI 語意' : '關鍵字'}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" size={13} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-lo)', pointerEvents: 'none',
          }} />
          <input
            className="input-field"
            style={{ height: 36, paddingLeft: 30, paddingRight: 10, fontSize: 'var(--font-base)', width: '100%', borderRadius: 0, borderLeft: 'none' }}
            placeholder={mode === 'semantic' ? '問任何問題...' : '搜尋關鍵字...'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <button
          className="btn-primary"
          type="submit"
          style={{ height: 36, padding: '0 16px', borderRadius: '0 8px 8px 0', whiteSpace: 'nowrap' }}
        >
          搜尋
        </button>
      </form>

      <button
        onClick={() => setTheme(toggleTheme())}
        title={theme === 'dark' ? '切換亮色模式' : '切換暗色模式'}
        style={{
          background: 'var(--color-surf-2)', border: '1px solid var(--color-line-faint)',
          borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--color-text-mid)',
        }}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>
    </header>
  );
}
