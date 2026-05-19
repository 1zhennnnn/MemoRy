import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../shared/api';
import Spinner from '../components/common/Spinner';

interface Source { id: string; title: string | null; summary: string | null; score?: number; }
interface WebSource { web?: { uri: string; title: string } }
interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  webSources?: WebSource[];
  toolCalls?: number;
  error?: boolean;
}

const STORAGE_KEY = 'memory_chat_history';

function loadHistory(): Message[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Message[]; }
  catch { return []; }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      // Only send text messages to API (no sources/toolCalls metadata)
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.agent.chat(apiMessages);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, sources: res.sources, webSources: res.webSources, toolCalls: res.toolCalls },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err instanceof Error ? err.message : '發生錯誤', error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)' }}>
          ✦ AI 知識助手
        </h1>
        {messages.length > 0 && (
          <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={clearHistory}>
            清除對話
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, color: 'var(--color-text-lo)', textAlign: 'center', padding: 32,
          }}>
            <div style={{ fontSize: 40 }}>🧠</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-mid)' }}>詢問你的知識庫</div>
            <div style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.7 }}>
              我可以搜尋你的筆記並回答問題。試試問：<br />
              <span style={{ color: 'var(--color-signal-light)' }}>「我筆記裡有哪些 AI 相關知識？」</span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user'
                  ? 'var(--color-signal-dim)'
                  : msg.error ? 'rgba(240,80,104,0.08)' : 'var(--color-surf-1)',
                border: `1px solid ${msg.role === 'user'
                  ? 'var(--color-signal-border)'
                  : msg.error ? 'rgba(240,80,104,0.3)' : 'var(--color-circuit-border)'}`,
                borderLeft: msg.role === 'assistant' && !msg.error ? '3px solid var(--color-circuit)' : undefined,
                borderRadius: msg.role === 'user' ? 12 : '0 12px 12px 12px',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--color-text-hi)',
                lineHeight: 1.7,
              }}
            >
              {msg.role === 'user' ? (
                <span>{msg.content}</span>
              ) : (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              )}
            </div>

            {/* Web Sources */}
            {msg.webSources && msg.webSources.length > 0 && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-lo)', marginLeft: 4 }}>🌐 網路資料</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {msg.webSources.filter((s) => s.web).map((s, i) => (
                    <a
                      key={i}
                      href={s.web!.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11, padding: '4px 8px',
                        background: 'var(--color-surf-2)',
                        border: '1px solid var(--color-line-faint)',
                        borderRadius: 6,
                        color: 'var(--color-signal-light)',
                        textDecoration: 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 320,
                      }}
                    >
                      ↗ {s.web!.title || s.web!.uri}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Note Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-lo)', marginLeft: 4 }}>
                  引用 {msg.sources.length} 筆筆記
                  {msg.toolCalls ? `（搜尋 ${msg.toolCalls} 次）` : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {msg.sources.map((s, si) => (
                    <Link
                      key={s.id}
                      to={`/notes/${s.id}`}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        background: 'var(--color-surf-2)',
                        border: '1px solid var(--color-line-faint)',
                        borderRadius: 6,
                        color: 'var(--color-text-mid)',
                        textDecoration: 'none',
                      }}
                    >
                      [{si + 1}] {s.title ?? '無標題'}
                      {s.score !== undefined && (
                        <span style={{ color: 'var(--color-text-lo)', marginLeft: 4 }}>
                          {Math.round(s.score * 100)}%
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'var(--color-surf-1)',
            border: '1px solid var(--color-circuit-border)',
            borderLeft: '3px solid var(--color-circuit)',
            borderRadius: '0 12px 12px 12px',
            fontSize: 12, color: 'var(--color-circuit-light)',
          }}>
            <Spinner size={12} color="var(--color-circuit-light)" />
            正在搜尋筆記庫…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--color-line-faint)', flexShrink: 0 }}
      >
        <input
          className="input-field"
          placeholder="問任何問題…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
          disabled={loading}
          autoFocus
        />
        <button className="btn-primary" type="submit" disabled={loading || !input.trim()}>
          {loading ? <Spinner size={16} color="#fff" /> : '發送'}
        </button>
      </form>
    </div>
  );
}
