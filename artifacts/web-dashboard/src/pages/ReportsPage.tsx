import { useState, useEffect } from 'react';
import Icon from '../components/common/Icon';
import { reports as rCache } from '../shared/pageCache';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { api } from '../shared/api';
import type { DailyReport } from '../shared/types';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>(rCache.get() ?? []);
  const [loading, setLoading] = useState(!rCache.get());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null);

  function handleDelete(date: string) {
    void api.reports.delete(date).then(() => {
      setReports((prev) => prev.filter((r) => r.reportDate !== date));
      setConfirmingDate(null);
    });
  }

  useEffect(() => {
    api.reports.list()
      .then((r) => { setReports(r); rCache.set(r); })
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
          {generating ? <Spinner size={14} color="var(--color-circuit-light)" /> : <><Icon name="sparkle" size={13} /> 生成今日日報</>}
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-failed)', fontSize: 13 }}>{error}</div>}

      {reports.length === 0 ? (
        <EmptyState
          icon="report"
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
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/reports/${r.reportDate}`, { state: { report: r } })}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-hi)' }}>
                  <Icon name="calendar" size={13} /> {format(parseISO(r.reportDate), 'yyyy年M月d日', { locale: zhTW })}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-lo)' }}>{r.noteCount} 筆</span>
                  {confirmingDate === r.reportDate ? (
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '2px 8px', color: 'var(--color-failed)', borderColor: 'var(--color-failed)' }}
                        onClick={() => handleDelete(r.reportDate)}
                      >
                        確認刪除
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => setConfirmingDate(null)}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '2px 8px' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmingDate(r.reportDate); }}
                    >
                      刪除
                    </button>
                  )}
                </div>
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
