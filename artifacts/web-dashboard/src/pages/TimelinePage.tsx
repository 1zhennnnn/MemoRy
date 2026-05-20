import { useState, useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { api } from '../shared/api';
import { timeline as tlCache } from '../shared/pageCache';
import type { NoteCard as NoteCardType } from '../shared/types';
import NoteCard from '../components/notes/NoteCard';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';

function groupByDate(notes: NoteCardType[]): [string, NoteCardType[]][] {
  const map = new Map<string, NoteCardType[]>();
  for (const note of notes) {
    const day = note.createdAt.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(note);
  }
  return [...map.entries()];
}

function formatDay(dateStr: string) {
  return format(parseISO(dateStr), 'yyyy年M月d日', { locale: zhTW });
}

export default function TimelinePage() {
  const cached = tlCache.get();
  const [notes, setNotes] = useState<NoteCardType[]>(cached?.notes ?? []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(cached?.totalPages ?? 1);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(!!cached);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (p: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.notes.list({ page: p, limit: 20 });
      const newNotes = p === 1 ? res.notes : [...notes, ...res.notes];
      setNotes(newNotes);
      const tp = Math.ceil(res.total / 20);
      setTotalPages(tp);
      if (p === 1) tlCache.set({ notes: newNotes, totalPages: tp });
    } catch {
      // silently fail — network error
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [loading]);

  useEffect(() => {
    void loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh first page when user returns to the tab (focus)
  useEffect(() => {
    const refresh = () => {
      void api.notes.list({ page: 1, limit: 20 }).then((res) => {
        setNotes(res.notes);
        setTotalPages(Math.ceil(res.total / 20));
        tlCache.set({ notes: res.notes, totalPages: Math.ceil(res.total / 20) });
      }).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && page < totalPages) {
          const next = page + 1;
          setPage(next);
          void loadPage(next);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, page, totalPages, loadPage]);

  function handleDelete(id: string) {
    void api.notes.delete(id).then(() => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    });
  }

  function handleRetry(id: string) {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, aiStatus: 'pending' } : n));
  }

  if (initialLoaded && notes.length === 0) {
    return (
      <EmptyState
        icon="note"
        title="還沒有筆記"
        description="安裝 Chrome Extension 開始擷取網頁知識"
      />
    );
  }

  const grouped = groupByDate(notes);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>時間軸</h1>
      </div>

      {grouped.map(([day, dayNotes]) => (
        <div key={day} className="tl-group">
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-mid)',
              fontWeight: 600,
              marginBottom: 4,
              paddingLeft: 4,
            }}
          >
            {formatDay(day)} · {dayNotes.length} 筆
          </div>
          <div className="tl-node" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayNotes.map((note) => (
              <NoteCard key={note.id} note={note} onDelete={handleDelete} onRetry={handleRetry} />
            ))}
          </div>
        </div>
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading && <Spinner />}
        {!loading && page >= totalPages && notes.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-text-lo)' }}>── 已載入全部 ──</span>
        )}
      </div>
    </div>
  );
}
