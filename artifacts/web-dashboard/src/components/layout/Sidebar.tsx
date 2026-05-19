import { NavLink } from 'react-router-dom';
import { getUserEmail, logout } from '../../shared/auth';

const SIDEBAR_W = 188;

const NAV_ITEMS = [
  { to: '/timeline',  label: '時間軸', icon: '📅' },
  { to: '/bookmarks', label: '書籤',   icon: '🔗' },
  { to: '/search',    label: '搜尋',   icon: '🔍' },
  { to: '/reports',   label: '日報',   icon: '📊' },
];


export default function Sidebar() {
  const email = getUserEmail() ?? '';

  return (
    <aside
      style={{
        width: SIDEBAR_W,
        minWidth: SIDEBAR_W,
        height: '100vh',
        background: 'var(--color-surf-1)',
        borderRight: '1px solid var(--color-line-faint)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 8px',
        gap: 4,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '8px 12px 16px' }}>
        <img src="/logo.png" alt="MemoRy" style={{ width: 140, height: 77, objectFit: 'contain' }} />
      </div>

      {/* New note button */}
      <NavLink
        to="/new"
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        style={{ marginBottom: 8, background: 'var(--color-signal-dim)', border: '1px solid var(--color-signal-border)', borderRadius: 8, justifyContent: 'center', fontWeight: 600, color: 'var(--color-signal-light)' }}
      >
        <span>✏</span>
        <span>新增筆記</span>
      </NavLink>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <hr className="sep" />
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span>⚙</span>
          <span>設定</span>
        </NavLink>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--color-text-lo)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={email}
        >
          {email || '未登入'}
        </div>
        <button
          className="btn-ghost"
          style={{ width: '100%', fontSize: 12, padding: '6px 12px' }}
          onClick={logout}
        >
          登出
        </button>
      </div>
    </aside>
  );
}
