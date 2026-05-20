import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { api } from '../shared/api';
import { getCached, setCached } from '../shared/noteCache';
import type { NoteDetail } from '../shared/types';
import TagBadge from '../components/common/TagBadge';
import AiStatusBadge from '../components/common/AiStatusBadge';
import NoteCard from '../components/notes/NoteCard';
import Spinner from '../components/common/Spinner';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sourceView, setSourceView] = useState<'iframe' | 'text' | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  useEffect(() => {
    if (!id) return;
    // Use cached data immediately if available (from hover prefetch)
    const cached = getCached(id);
    if (cached) {
      setNote(cached);
      setUserNote(cached.userNote ?? '');
      setTags(cached.tags ?? []);
      setTitleDraft(cached.aiTitle ?? '');
      setSummaryDraft(cached.aiSummary ?? '');
      setSourceView(cached.noteType === 'page' && cached.sourceUrl ? 'iframe' : 'text');
      setLoading(false);
    } else {
      setNote(null);
      setLoading(true);
    }
    setExpanded(false);
    setEditingTitle(false);
    setEditingSummary(false);
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchNote() {
      try {
        const n = await api.notes.get(id!);
        if (cancelled) return;
        setCached(id!, n);
        setNote(n);
        setUserNote(n.userNote ?? '');
        setTags(n.tags ?? []);
        setTitleDraft(n.aiTitle ?? '');
        setSummaryDraft(n.aiSummary ?? '');
        // default to iframe only for full-page captures with a sourceUrl
        setSourceView(n.noteType === 'page' && n.sourceUrl ? 'iframe' : 'text');

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

  async function saveTitle() {
    if (!id || !note) return;
    const title = titleDraft.trim() || (note.aiTitle ?? '');
    setNote((prev) => prev ? { ...prev, aiTitle: title } : prev);
    setEditingTitle(false);
    try { await api.notes.patch(id, { aiTitle: title }); } catch {}
  }

  async function saveSummary() {
    if (!id || !note) return;
    const summary = summaryDraft.trim();
    setNote((prev) => prev ? { ...prev, aiSummary: summary } : prev);
    setEditingSummary(false);
    try { await api.notes.patch(id, { aiSummary: summary }); } catch {}
  }

  async function saveTags(newTags: string[]) {
    if (!id || !note) return;
    setTags(newTags);
    setNote((prev) => prev ? { ...prev, tags: newTags } : prev);
    try { await api.notes.patch(id, { tags: newTags }); } catch {}
  }

  function addTag() {
    const t = tagInput.trim().replace(/\s+/g, '_');
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    void saveTags([...tags, t]);
    setTagInput('');
  }

  async function deleteNote() {
    if (!id) return;
    await api.notes.delete(id);
    navigate('/timeline');
  }

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

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/timeline" style={{ color: 'var(--color-text-lo)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="chevronLeft" size={14} /> 返回
            </Link>
            <AiStatusBadge status={note.aiStatus} />
          </div>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--color-failed)', borderColor: 'var(--color-failed)' }}
                onClick={deleteNote}>
                確認刪除
              </button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setConfirmDelete(false)}>
                取消
              </button>
            </div>
          ) : (
            <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--color-text-lo)' }}
              onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={13} /> 刪除
            </button>
          )}
        </div>

        {editingTitle ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              autoFocus
              className="input-field"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              style={{ fontSize: 18, fontWeight: 700, flex: 1 }}
            />
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={saveTitle}>儲存</button>
            <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setEditingTitle(false)}>取消</button>
          </div>
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)', cursor: 'text', borderRadius: 4, padding: '2px 4px', margin: '-2px -4px' }}
            title="點擊編輯標題"
          >
            {note.aiTitle ?? '無標題'}
          </h1>
        )}

        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tags.map((t) => (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--color-signal-dim)', border: '1px solid var(--color-signal-border)',
              borderRadius: 6, padding: '2px 8px', fontSize: 12, color: 'var(--color-signal-light)',
            }}>
              {t}
              <button onClick={() => void saveTags(tags.filter((x) => x !== t))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-lo)', fontSize: 11, padding: 0, lineHeight: 1 }}>
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}

          {editingTags ? (
            <input
              autoFocus
              className="input-field"
              placeholder="新增標籤…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } if (e.key === 'Escape') setEditingTags(false); }}
              style={{ width: 110, padding: '2px 8px', fontSize: 12, height: 26 }}
            />
          ) : (
            <button className="btn-ghost" onClick={() => setEditingTags(true)}
              style={{ fontSize: 11, padding: '2px 8px', height: 24 }}>
              ＋ 標籤
            </button>
          )}
          {editingTags && (
            <button className="btn-ghost" onClick={() => { addTag(); setEditingTags(false); }}
              style={{ fontSize: 11, padding: '2px 8px', height: 24 }}>
              完成
            </button>
          )}
        </div>

        {/* AI Summary */}
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sparkle" size={12} /> 摘要
            {!editingSummary && (
              <button onClick={() => setEditingSummary(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-lo)', fontSize: 11, padding: '0 4px', marginLeft: 4 }}>
                <Icon name="pencil" size={11} />
              </button>
            )}
          </div>
          {editingSummary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                autoFocus
                className="input-field"
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingSummary(false); }}
                style={{ minHeight: 100, resize: 'vertical', fontSize: 13, lineHeight: 1.7 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ padding: '6px 16px', fontSize: 12 }} onClick={saveSummary}>儲存</button>
                <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditingSummary(false)}>取消</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingSummary(true)}
              style={{
                background: 'var(--color-surf-1)',
                border: '1px solid var(--color-circuit-border)',
                borderLeft: '3px solid var(--color-circuit)',
                borderRadius: '0 var(--radius-card) var(--radius-card) 0',
                padding: 16, fontSize: 13,
                color: note.aiSummary ? 'var(--color-text-hi)' : 'var(--color-text-lo)',
                lineHeight: 1.7, cursor: 'text',
              }}
            >
              {note.aiSummary || '點擊新增摘要…'}
            </div>
          )}
        </section>

        {/* Source view */}
        {(note.sourceText || note.ocrText || note.sourceUrl) && (
          <section>
            {/* Toggle bar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-ghost"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '▲ 收起' : '▼ 展開原始內容'}
              </button>
              {expanded && note.sourceUrl && (
                <>
                  {(sourceView === 'text' || iframeError) && (
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}
                      onClick={() => { setSourceView('iframe'); setIframeError(false); }}>
                      <Icon name="globe" size={12} /> 網頁
                    </button>
                  )}
                  {sourceView === 'iframe' && !iframeError && (
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}
                      onClick={() => setSourceView('text')}>
                      <Icon name="note" size={12} /> 文字
                    </button>
                  )}
                  <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px', textDecoration: 'none' }}>
                    ↗ 新分頁
                  </a>
                </>
              )}
            </div>

            {expanded && (
              <div style={{ marginTop: 8 }}>
                {/* iframe — inline, extends to fill viewport width minus sidebar */}
                {note.sourceUrl && (sourceView === 'iframe') && !iframeError ? (
                  <div style={{
                    width: '100%',
                    borderRadius: 'var(--radius-card)',
                    overflow: 'hidden',
                    border: '1px solid var(--color-line-faint)',
                  }}>
                    <iframe
                      src={note.sourceUrl}
                      style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                      sandbox="allow-scripts allow-same-origin allow-forms"
                      onError={() => setIframeError(true)}
                    />
                  </div>
                ) : (
                  /* Text view fallback */
                  <div
                    style={{
                      background: 'var(--color-surf-1)',
                      border: '1px solid var(--color-line-faint)',
                      borderRadius: 'var(--radius-card)',
                      padding: 16, fontSize: 12,
                      color: 'var(--color-text-mid)',
                      lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
                    }}
                  >
                    {iframeError && (
                      <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--color-failed)' }}>
                        <Icon name="warning" size={12} style={{ display: 'inline', marginRight: 4 }} /> 此網站不允許嵌入顯示，改為顯示擷取的文字
                      </div>
                    )}
                    {note.sourceText ?? note.ocrText ?? '（無文字內容）'}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* User note */}
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-mid)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="pencil" size={12} /> 我的備注</div>
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
            <div style={{ color: 'var(--color-text-mid)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <Icon name="link" size={12} style={{ marginTop: 1, flexShrink: 0 }} />
              <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--color-signal-light)', textDecoration: 'none', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {note.sourceUrl.length > 40 ? note.sourceUrl.slice(0, 40) + '...' : note.sourceUrl}
              </a>
            </div>
          )}
          <div style={{ color: 'var(--color-text-lo)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={12} />
            {note.createdAt ? format(parseISO(note.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhTW }) : '—'}
          </div>
          <div style={{ color: 'var(--color-text-lo)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name={note.noteType === 'image' ? 'image' : 'note'} size={12} />
            {note.noteType === 'image' ? '截圖' : note.noteType === 'page' ? '整頁擷取' : '文字'}
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
