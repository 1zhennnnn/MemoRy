import { NavLink, Link } from 'react-router-dom';
import { getUserEmail } from '../../shared/auth';
import Icon from '../common/Icon';
import { timeline, reports } from '../../shared/pageCache';

const SIDEBAR_W = 188;

const PREFETCH: Record<string, () => void> = {
  '/timeline': timeline.prefetch,
  '/reports':  reports.prefetch,
};

const NAV_ITEMS = [
  { to: '/graph',    label: '知識星座圖', icon: 'graph'    },
  { to: '/timeline', label: '時間軸',     icon: 'calendar' },
  { to: '/reports',  label: '日報',       icon: 'report'   },
] as const;

interface SidebarProps {
  chatOpen: boolean;
  onChatToggle: () => void;
}

export default function Sidebar({ chatOpen, onChatToggle }: SidebarProps) {
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
      <Link to="/graph" style={{ display: 'block', padding: '8px 12px 16px' }}>
        <img src="/logo.png" alt="MemoRy" style={{ width: 140, height: 77, objectFit: 'contain' }} />
      </Link>

      <NavLink
        to="/new"
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        style={{ marginBottom: 8, background: 'var(--color-signal-dim)', border: '1px solid var(--color-signal-border)', borderRadius: 8, justifyContent: 'center', fontWeight: 600, color: 'var(--color-signal-light)' }}
      >
        <Icon name="pencil" size={14} />
        <span>新增筆記</span>
      </NavLink>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onMouseEnter={() => PREFETCH[to]?.()}
          >
            <Icon name={icon} size={14} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* AI 助手：在側欄開啟抽屜 */}
        <button
          onClick={onChatToggle}
          className={`nav-item${chatOpen ? ' active' : ''}`}
          style={{ width: '100%', background: 'none', border: chatOpen ? undefined : 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <Icon name="sparkle" size={14} />
          <span>AI 助手</span>
        </button>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <hr className="sep" />
        <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Icon name="settings" size={14} />
          <span>設定</span>
        </NavLink>
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--color-text-lo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>
          {email || '未登入'}
        </div>
      </div>
    </aside>
  );
}
