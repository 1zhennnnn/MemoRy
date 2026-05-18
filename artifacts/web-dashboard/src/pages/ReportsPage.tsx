import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { api } from '../shared/api';
import type { DailyReport } from '../shared/types';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.reports.list()
      .then(setReports)
      .catch(() => setError('載入日報失敗'))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const r = await api.reports.generate();
      setReports((prev) => {
        const filtered = prev.filter((p) => p.reportDate !== r.reportDate);
        return [r, ...filtered];
      });
      navigate(`/reports/${r.reportDate}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失敗');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>知識日報</h1>
        <button className="btn-ai" onClick={handleGenerate} disabled={generating}>
          {generating ? <Spinner size={14} color="var(--color-circuit-light)" /> : '✦ 生成今日日報'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-failed)', fontSize: 13 }}>{error}</div>}

      {reports.length === 0 ? (
        <EmptyState
          icon="📅"
          title="尚無日報"
          description="需至少 3 筆筆記才能生成日報"
          action={{ label: '生成今日日報', onClick: handleGenerate }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map((r) => (
            <div
              key={r.reportDate}
              className="memory-card"
              onClick={() => navigate(`/reports/${r.reportDate}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-hi)' }}>
                  📅 {format(parseISO(r.reportDate), 'yyyy年M月d日', { locale: zhTW })}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-lo)' }}>{r.noteCount} 筆</span>
              </div>
              {r.keyLearnings[0] && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-mid)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  • {r.keyLearnings[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
