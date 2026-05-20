import { useState, useEffect, useRef } from 'react';
import NoteCard from '../components/notes/NoteCard';
import Icon from '../components/common/Icon';
import { useParams, Link, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { api } from '../shared/api';
import type { DailyReport, NoteCard as NoteCardType } from '../shared/types';
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
  const location = useLocation();
  const prefilled = (location.state as { report?: DailyReport } | null)?.report ?? null;

  const [report, setReport] = useState<DailyReport | null>(prefilled);
  const [loading, setLoading] = useState(!prefilled);
  const [fetchError, setFetchError] = useState('');
  const [diary, setDiary] = useState(prefilled?.diaryText ?? '');
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);
  // null = still loading, [] = no results, [...] = loaded
  const [relatedNotes, setRelatedNotes] = useState<NoteCardType[] | null>(null);

  useEffect(() => {
    if (!date) return;
    setRelatedNotes(null);

    // If we already have data from navigation state, skip the main fetch
    if (!prefilled) {
      setLoading(true);
      setFetchError('');
      api.reports.get(date)
        .then((r) => { setReport(r); setDiary(r.diaryText ?? ''); })
        .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : '載入失敗'))
        .finally(() => setLoading(false));
    }

    // Always fetch related notes (RAG, separate slow endpoint)
    api.reports.getRelated(date)
      .then((r) => setRelatedNotes((r.relatedNotes ?? []) as NoteCardType[]))
      .catch(() => setRelatedNotes([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return (
      <div style={{ color: 'var(--color-text-lo)', padding: 32 }}>
        {fetchError ? `載入失敗：${fetchError}` : '日報不存在'}
      </div>
    );
  }

  const dateLabel = format(parseISO(report.reportDate), 'yyyy年M月d日', { locale: zhTW });

  // Show sidebar while loading or when there are results
  const showSidebar = relatedNotes === null || relatedNotes.length > 0;

  return (
    <div style={{ maxWidth: showSidebar ? 1080 : 720, margin: '0 auto', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/reports" style={{ color: 'var(--color-text-lo)', textDecoration: 'none', fontSize: 13 }}>
            ← 日報列表
          </Link>
          <span style={{ color: 'var(--color-text-lo)' }}>·</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-hi)' }}>
            <Icon name="calendar" size={16} style={{ display: 'inline', marginRight: 6 }} /> {dateLabel} 知識日報
          </h1>
          <span style={{ fontSize: 12, color: 'var(--color-text-lo)', marginLeft: 'auto' }}>
            {report.noteCount} 筆筆記
          </span>
        </div>

        {/* Summary */}
        {report.keyLearnings.length > 0 && (
          <section>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8 }}>
              <Icon name="list" size={12} style={{ display: 'inline', marginRight: 5 }} /> 今日學習要點
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
              <Icon name="shuffle" size={12} style={{ display: 'inline', marginRight: 5 }} /> 跨域聯想
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
              <Icon name="lightbulb" size={12} style={{ display: 'inline', marginRight: 5 }} /> 延伸建議
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
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="pencil" size={12} /> 今日日記
            </div>
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

      {/* Sidebar: RAG recommendations */}
      {showSidebar && (
        <aside style={{ width: 280, flexShrink: 0, position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 4, borderBottom: '1px solid var(--color-line-faint)' }}>
            <Icon name="sparkle" size={12} /> 推薦閱讀
          </div>
          {relatedNotes === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <Spinner size={16} />
            </div>
          ) : (
            relatedNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))
          )}
        </aside>
      )}
    </div>
  );
}
