import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../shared/api';
import type { NoteCard as NoteCardType, SearchResponse } from '../shared/types';
import NoteCard from '../components/notes/NoteCard';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';
import Icon from '../components/common/Icon';

type Mode = 'semantic' | 'keyword';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const mode = (searchParams.get('mode') ?? 'semantic') as Mode;

  const [loading, setLoading] = useState(false);
  const [semanticResult, setSemanticResult] = useState<SearchResponse | null>(null);
  const [keywordResult, setKeywordResult] = useState<NoteCardType[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setSemanticResult(null);
    setKeywordResult(null);

    const run = async () => {
      try {
        if (mode === 'semantic') {
          setSemanticResult(await api.search.semantic(q));
        } else {
          const res = await api.search.keyword(q);
          setKeywordResult(res.notes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '搜尋失敗');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [q, mode]);

  if (!q.trim()) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <EmptyState icon="search" title="輸入關鍵字開始搜尋" description="使用上方搜尋框，選擇 AI 語意或關鍵字模式" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-hi)' }}>
          {mode === 'semantic' ? 'AI 語意搜尋' : '關鍵字搜尋'}
        </h1>
        <span style={{ fontSize: 13, color: 'var(--color-text-lo)' }}>「{q}」</span>
        {loading && <Spinner size={14} />}
      </div>

      {error && <div style={{ color: 'var(--color-failed)', fontSize: 13 }}>{error}</div>}

      {/* Semantic result */}
      {semanticResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {semanticResult.answer && (
            <div style={{
              background: 'var(--color-surf-1)',
              border: '1px solid var(--color-circuit-border)',
              borderLeft: '3px solid var(--color-circuit)',
              borderRadius: '0 var(--radius-card) var(--radius-card) 0',
              padding: 16,
            }}>
              <div style={{ fontSize: 12, color: 'var(--color-circuit-light)', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="sparkle" size={12} /> AI 回答
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-hi)', lineHeight: 1.7 }}>
                <ReactMarkdown>{semanticResult.answer}</ReactMarkdown>
              </div>
            </div>
          )}

          {semanticResult.sources.length > 0 ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-mid)', marginBottom: 8, fontWeight: 600 }}>
                引用來源（{semanticResult.sources.length} 筆）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {semanticResult.sources.map((note, i) => (
                  <div key={note.id} style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, color: 'var(--color-text-lo)', zIndex: 1 }}>
                      [{i + 1}]
                    </span>
                    <NoteCard note={note} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="search" title="找不到相關筆記" description="試試其他關鍵字" />
          )}
        </div>
      )}

      {/* Keyword result */}
      {keywordResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keywordResult.length === 0 ? (
            <EmptyState icon="search" title="找不到相關筆記" description="試試其他關鍵字" />
          ) : (
            keywordResult.map((note) => <NoteCard key={note.id} note={note} />)
          )}
        </div>
      )}
    </div>
  );
}
