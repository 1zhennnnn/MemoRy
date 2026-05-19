import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { api } from '../shared/api';
import type { NoteDetail } from '../shared/types';
import TagBadge from '../components/common/TagBadge';
import AiStatusBadge from '../components/common/AiStatusBadge';
import NoteCard from '../components/notes/NoteCard';
import Spinner from '../components/common/Spinner';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchNote() {
      try {
        const n = await api.notes.get(id!);
        if (cancelled) return;
        setNote(n);
        setUserNote(n.userNote ?? '');

        if (n.aiStatus === 'pending') {
          intervalId = setInterval(async () => {
            try {
              const updated = await api.notes.get(id!);
              if (cancelled) return;
              setNote(updated);
              if (updated.aiStatus !== 'pending' && intervalId) {
                clearInterval(intervalId);
              }
            } catch {}
          }, 3000);
        }
      } catch {}
      finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchNote();
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [id]);

  async function saveNote() {
    if (!id || !note) return;
    setSaving(true);
    try {
      await api.notes.patch(id, { userNote });
      setNote((prev) => prev ? { ...prev, userNote } : prev);
    } catch {} finally {
      setSaving(false);
      setEditingNote(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    );
  }

  if (!note) {
    return <div style={{ color: 'var(--color-text-lo)', padding: 32 }}>筆記不存在</div>;
  }

  const allTags = note.tags.map((t) => ({ label: t, variant: 'ai' as const }));

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/timeline" style={{ color: 'var(--color-text-lo)', textDecoration: 'none', fontSize: 13 }}>← 返回</Link>
          <AiStatusBadge status={note.aiStatus} />
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>
          {note.aiTitle ?? '無標題'}
        </h1>

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allTags.map((t, i) => <TagBadge key={i} label={t.label} variant={t.variant} />)}
          </div>
        )}

        {/* AI Summary */}
        {note.aiSummary && (
          <section>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8 }}>📄 AI 摘要</div>
            <div
              style={{
                background: 'var(--color-surf-1)',
                border: '1px solid var(--color-circuit-border)',
                borderLeft: '3px solid var(--color-circuit)',
                borderRadius: '0 var(--radius-card) var(--radius-card) 0',
                padding: 16,
                fontSize: 13,
                color: 'var(--color-text-hi)',
                lineHeight: 1.7,
              }}
            >
              {note.aiSummary}
            </div>
          </section>
        )}

        {/* Source text */}
        {(note.sourceText || note.ocrText) && (
          <section>
            <button
              className="btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '▲ 收起原始文字' : '▼ 展開原始文字'}
            </button>
            {expanded && (
              <div
                style={{
                  marginTop: 8,
                  background: 'var(--color-surf-1)',
                  border: '1px solid var(--color-line-faint)',
                  borderRadius: 'var(--radius-card)',
                  padding: 16,
                  fontSize: 12,
                  color: 'var(--color-text-mid)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {note.sourceText ?? note.ocrText}
              </div>
            )}
          </section>
        )}

        {/* User note */}
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8 }}>💬 我的備注</div>
          {editingNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                className="input-field"
                style={{ minHeight: 100, resize: 'vertical' }}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="新增備注..."
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ padding: '6px 16px' }} onClick={saveNote} disabled={saving}>
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setEditingNote(false)}>取消</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingNote(true)}
              style={{
                background: 'var(--color-surf-1)',
                border: '1px solid var(--color-line-faint)',
                borderRadius: 'var(--radius-card)',
                padding: 14,
                fontSize: 13,
                color: note.userNote ? 'var(--color-text-hi)' : 'var(--color-text-lo)',
                cursor: 'text',
                minHeight: 60,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {note.userNote || '點擊新增備注...'}
            </div>
          )}
        </section>
      </div>

      {/* Sidebar */}
      <aside style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Source info */}
        <div
          style={{
            background: 'var(--color-surf-1)',
            border: '1px solid var(--color-line-faint)',
            borderRadius: 'var(--radius-card)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 4 }}>來源資訊</div>
          {note.sourceUrl && (
            <div style={{ color: 'var(--color-text-mid)' }}>
              🔗{' '}
              <a
                href={note.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-signal-light)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}
              >
                {note.sourceUrl.length > 40 ? note.sourceUrl.slice(0, 40) + '...' : note.sourceUrl}
              </a>
            </div>
          )}
          <div style={{ color: 'var(--color-text-lo)' }}>
            📅 {note.createdAt ? format(parseISO(note.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhTW }) : '—'}
          </div>
          <div style={{ color: 'var(--color-text-lo)' }}>
            📦 {note.noteType === 'image' ? '截圖' : '文字'}類型
          </div>
        </div>

        {/* Related notes */}
        {note.relatedNotes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)' }}>相關筆記</div>
            {note.relatedNotes.map((r) => (
              <NoteCard key={r.id} note={r} />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
