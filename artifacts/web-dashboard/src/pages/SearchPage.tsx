import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../shared/api';
import type { NoteCard as NoteCardType, SearchResponse } from '../shared/types';
import NoteCard from '../components/notes/NoteCard';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';

type Mode = 'semantic' | 'keyword';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const [q, setQ] = useState(initialQ);
  const [mode, setMode] = useState<Mode>('semantic');
  const [loading, setLoading] = useState(false);
  const [semanticResult, setSemanticResult] = useState<SearchResponse | null>(null);
  const [keywordResult, setKeywordResult] = useState<NoteCardType[] | null>(null);
  const [error, setError] = useState('');

  async function runSearch(query: string, m: Mode) {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSemanticResult(null);
    setKeywordResult(null);
    try {
      if (m === 'semantic') {
        const res = await api.search.semantic(query);
        setSemanticResult(res);
      } else {
        const res = await api.search.keyword(query);
        setKeywordResult(res.notes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜尋失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQ) void runSearch(initialQ, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runSearch(q, mode);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>搜尋</h1>

      {/* Search input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          className="input-field"
          placeholder="搜尋你的知識..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? <Spinner size={16} color="#fff" /> : '搜尋'}
        </button>
      </form>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 16 }}>
        {(['semantic', 'keyword'] as Mode[]).map((m) => (
          <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--color-text-mid)' }}>
            <input
              type="radio"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
              style={{ accentColor: 'var(--color-signal)' }}
            />
            {m === 'semantic' ? '語意搜尋（RAG）' : '關鍵字搜尋'}
          </label>
        ))}
      </div>

      {error && (
        <div style={{ color: 'var(--color-failed)', fontSize: 13 }}>{error}</div>
      )}

      {/* Semantic result */}
      {semanticResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {semanticResult.answer && (
            <div
              style={{
                background: 'var(--color-surf-1)',
                border: '1px solid var(--color-circuit-border)',
                borderLeft: '3px solid var(--color-circuit)',
                borderRadius: '0 var(--radius-card) var(--radius-card) 0',
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--color-circuit-light)', marginBottom: 8, fontWeight: 600 }}>
                💡 AI 回答
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-hi)', lineHeight: 1.7 }}>
                <ReactMarkdown>{semanticResult.answer}</ReactMarkdown>
              </div>
            </div>
          )}

          {semanticResult.sources.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-mid)', marginBottom: 8, fontWeight: 600 }}>
                引用來源（{semanticResult.sources.length} 筆）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {semanticResult.sources.map((note, i) => (
                  <div key={note.id} style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        fontSize: 11,
                        color: 'var(--color-text-lo)',
                        zIndex: 1,
                      }}
                    >
                      [{i + 1}]
                    </span>
                    <NoteCard note={note} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {semanticResult.sources.length === 0 && (
            <EmptyState icon="🔍" title="找不到相關筆記" description="試試其他關鍵字" />
          )}
        </div>
      )}

      {/* Keyword result */}
      {keywordResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keywordResult.length === 0 ? (
            <EmptyState icon="🔍" title="找不到相關筆記" description="試試其他關鍵字" />
          ) : (
            keywordResult.map((note) => <NoteCard key={note.id} note={note} />)
          )}
        </div>
      )}
    </div>
  );
}
