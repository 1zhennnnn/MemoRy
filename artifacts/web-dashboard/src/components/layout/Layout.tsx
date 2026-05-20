import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChatPage from '../../pages/ChatPage';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar chatOpen={chatOpen} onChatToggle={() => setChatOpen((o) => !o)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>

      {/* AI 助手抽屜 */}
      <div style={{
        position: 'fixed',
        right: chatOpen ? 0 : -440,
        top: 0,
        bottom: 0,
        width: 420,
        background: 'var(--color-surf-0)',
        borderLeft: '1px solid var(--color-line-faint)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: chatOpen ? '-4px 0 32px rgba(0,0,0,0.25)' : 'none',
        transition: 'right 240ms ease',
      }}>
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-line-faint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-hi)' }}>✦ AI 助手</span>
          <button
            onClick={() => setChatOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-lo)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {chatOpen && <ChatPage />}
        </div>
      </div>
    </div>
  );
}
