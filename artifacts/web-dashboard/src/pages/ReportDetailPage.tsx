import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { api } from '../shared/api';
import type { DailyReport } from '../shared/types';
import Spinner from '../components/common/Spinner';

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function ReportDetailPage() {
  const { date } = useParams<{ date: string }>();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [diary, setDiary] = useState('');
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    api.reports.get(date)
      .then((r) => { setReport(r); setDiary(r.diaryText ?? ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  const debouncedDiary = useDebounce(diary, 1200);

  useEffect(() => {
    if (!date || !report) return;
    if (debouncedDiary === (report.diaryText ?? '')) return;
    savedRef.current = false;
    setSaving(true);
    api.reports.patch(date, debouncedDiary)
      .then(() => {
        setReport((prev) => prev ? { ...prev, diaryText: debouncedDiary } : prev);
        savedRef.current = true;
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDiary]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    );
  }

  if (!report) {
    return <div style={{ color: 'var(--color-text-lo)', padding: 32 }}>日報不存在</div>;
  }

  const dateLabel = format(parseISO(report.reportDate), 'yyyy年M月d日', { locale: zhTW });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/reports" style={{ color: 'var(--color-text-lo)', textDecoration: 'none', fontSize: 13 }}>
          ← 日報列表
        </Link>
        <span style={{ color: 'var(--color-text-lo)' }}>·</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-hi)' }}>
          📅 {dateLabel} 知識日報
        </h1>
        <span style={{ fontSize: 12, color: 'var(--color-text-lo)', marginLeft: 'auto' }}>
          {report.noteCount} 筆筆記
        </span>
      </div>

      {/* Summary */}
      {report.keyLearnings.length > 0 && (
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8 }}>
            📚 今日學習要點
          </div>
          <div
            style={{
              background: 'var(--color-surf-1)',
              border: '1px solid var(--color-line-faint)',
              borderRadius: 'var(--radius-card)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {report.keyLearnings.map((b, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--color-text-hi)' }}>• {b}</div>
            ))}
          </div>
        </section>
      )}

      {/* Cross-domain */}
      {report.crossDomain && (
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8 }}>
            🔀 跨域聯想
          </div>
          <div
            style={{
              background: 'var(--color-surf-1)',
              border: '1px solid var(--color-circuit-border)',
              borderRadius: 'var(--radius-card)',
              padding: 16,
              fontSize: 13,
              color: 'var(--color-text-hi)',
              lineHeight: 1.7,
            }}
          >
            <ReactMarkdown>{report.crossDomain}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* Suggestions */}
      {report.suggestions.length > 0 && (
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8 }}>
            💡 延伸建議
          </div>
          <div
            style={{
              background: 'var(--color-surf-1)',
              border: '1px solid var(--color-line-faint)',
              borderRadius: 'var(--radius-card)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {report.suggestions.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--color-text-hi)' }}>• {s}</div>
            ))}
          </div>
        </section>
      )}

      {/* Diary */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)' }}>📝 今日日記</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-lo)' }}>
            {saving ? '儲存中...' : '自動儲存 ✓'}
          </div>
        </div>
        <textarea
          className="input-field"
          style={{ minHeight: 160, resize: 'vertical', lineHeight: 1.7 }}
          placeholder="記錄今日的思考與收穫..."
          value={diary}
          onChange={(e) => setDiary(e.target.value)}
        />
      </section>
    </div>
  );
}
