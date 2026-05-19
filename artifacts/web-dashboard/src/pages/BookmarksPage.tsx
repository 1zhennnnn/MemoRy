import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import type { NoteCard } from '../shared/types';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';

function domain(url: string | null) {
  if (!url) return '';
  try { return new URL(url).hostname; } catch { return url; }
}

export default function BookmarksPage() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<NoteCard[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (p: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.notes.list({ page: p, limit: 30, type: 'bookmarks' });
      setBookmarks((prev) => (p === 1 ? res.notes : [...prev, ...res.notes]));
      setTotalPages(Math.ceil(res.total / 30));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [loading]);

  useEffect(() => { void loadPage(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading && page < totalPages) {
        const next = page + 1;
        setPage(next);
        void loadPage(next);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, page, totalPages, loadPage]);

  function handleDelete(id: string) {
    void api.notes.delete(id).then(() => {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      setConfirmingId(null);
    });
  }

  if (initialLoaded && bookmarks.length === 0) {
    return (
      <EmptyState
        icon="🔗"
        title="還沒有書籤"
        description="在 Chrome Extension 側欄按「快速書籤」即可儲存當前頁面"
      />
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>書籤</h1>
        <span style={{ fontSize: 12, color: 'var(--color-text-lo)' }}>{bookmarks.length} 筆</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bookmarks.map((b) => {
          const timeAgo = b.createdAt
            ? formatDistanceToNow(new Date(b.createdAt), { addSuffix: true, locale: zhTW })
            : '';
          return (
            <div
              key={b.id}
              className="memory-card"
              style={{ cursor: 'pointer', borderLeft: '3px solid var(--color-signal)' }}
              onClick={() => navigate(`/notes/${b.id}`)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 14, color: 'var(--color-text-hi)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  🔗 {b.aiTitle ?? b.sourceUrl ?? '未命名書籤'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-lo)', marginTop: 4, display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{domain(b.sourceUrl)}</span>
                  <span>·</span>
                  <span>{timeAgo}</span>
                </div>
              </div>

              {confirmingId === b.id ? (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '4px 8px', color: 'var(--color-failed)', borderColor: 'var(--color-failed)' }}
                    onClick={() => handleDelete(b.id)}
                  >確認刪除</button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => setConfirmingId(null)}
                  >取消</button>
                </div>
              ) : (
                <button
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); setConfirmingId(b.id); }}
                >刪除</button>
              )}
            </div>
          );
        })}
      </div>

      <div ref={sentinelRef} style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading && <Spinner />}
        {!loading && page >= totalPages && bookmarks.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-text-lo)' }}>── 已載入全部 ──</span>
        )}
      </div>
    </div>
  );
}
