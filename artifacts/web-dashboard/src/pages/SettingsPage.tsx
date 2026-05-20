import { useState, useEffect } from 'react';
import Icon from '../components/common/Icon';
import { getUserEmail, logout } from '../shared/auth';
import { api, healthz } from '../shared/api';
import Spinner from '../components/common/Spinner';

export default function SettingsPage() {
  const email = getUserEmail() ?? '未登入';
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    api.notes.list({ page: 1, limit: 1 })
      .then((res) => setNoteCount(res.total))
      .catch(() => setNoteCount(null));

    healthz().then(setHealthOk);
  }, []);

  function handleExport(format: 'json' | 'markdown') {
    const url = api.export.url(format);
    window.open(url, '_blank');
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>設定</h1>

      {/* Account */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 10 }}>帳戶</div>
        <div
          style={{
            background: 'var(--color-surf-1)',
            border: '1px solid var(--color-line-faint)',
            borderRadius: 'var(--radius-card)',
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--color-signal-dim)',
                border: '1px solid var(--color-signal-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              <Icon name="cpu" size={18} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-text-hi)' }}>{email}</span>
          </div>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={logout}>
            登出
          </button>
        </div>
      </section>

      {/* Export */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 10 }}>資料匯出</div>
        <div
          style={{
            background: 'var(--color-surf-1)',
            border: '1px solid var(--color-line-faint)',
            borderRadius: 'var(--radius-card)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--color-text-mid)' }}>
            將所有筆記匯出為：
            {noteCount !== null && (
              <span style={{ marginLeft: 8, color: 'var(--color-text-lo)' }}>
                共 {noteCount} 筆
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleExport('json')}><Icon name="download" size={13} /> JSON</button>
            <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleExport('markdown')}><Icon name="download" size={13} /> Markdown</button>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 10 }}>關於</div>
        <div
          style={{
            background: 'var(--color-surf-1)',
            border: '1px solid var(--color-line-faint)',
            borderRadius: 'var(--radius-card)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ color: 'var(--color-text-hi)', fontWeight: 600 }}>MemoRy v1.0.0</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-lo)' }}>
            <span>API 狀態：</span>
            {healthOk === null ? (
              <Spinner size={12} />
            ) : healthOk ? (
              <span style={{ color: 'var(--color-done)' }}>✓ 正常</span>
            ) : (
              <span style={{ color: 'var(--color-failed)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="close" size={12} /> 連線失敗</span>
            )}
          </div>
          <div style={{ color: 'var(--color-text-lo)', fontSize: 11 }}>
            AI 碎片化知識管理系統 · Powered by Gemma & Supabase
          </div>
        </div>
      </section>
    </div>
  );
}
