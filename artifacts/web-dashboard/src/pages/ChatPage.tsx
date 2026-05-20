import { useState, useRef, useEffect, type FormEvent } from 'react';
import Icon from '../components/common/Icon';
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
  error?: boolean;
}
interface ConvMeta { id: string; title: string; updatedAt: string; }

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConvMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.agent.listConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function selectConversation(id: string) {
    setActiveId(id);
    const conv = await api.agent.getConversation(id);
    setMessages((conv.messages as Message[]) ?? []);
  }

  async function newConversation() {
    const conv = await api.agent.createConversation();
    setConversations((prev) => [conv as ConvMeta, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await api.agent.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');

    // Show message immediately — before any async operation that might throw
    const userMsg: Message = { role: 'user', content: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    let convId = activeId;
    if (!convId) {
      try {
        const conv = await api.agent.createConversation(q.slice(0, 40));
        setConversations((prev) => [conv as ConvMeta, ...prev]);
        convId = conv.id;
        setActiveId(convId);
      } catch (err) {
        console.error('[Chat] createConversation failed:', err);
      }
    }

    try {
      const apiMsgs = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.agent.chat(apiMsgs);
      const assistantMsg: Message = { role: 'assistant', content: res.answer, sources: res.sources, webSources: res.webSources };
      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      const isFirst = nextMessages.length === 1;
      if (convId) {
        await api.agent.updateConversation(convId, {
          messages: finalMessages,
          ...(isFirst ? { title: q.slice(0, 40) } : {}),
        }).catch(() => {});
        if (isFirst) setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: q.slice(0, 40) } : c));
      }
    } catch (err) {
      const errMsg: Message = { role: 'assistant', content: err instanceof Error ? err.message : '發生錯誤', error: true };
      const finalMessages = [...nextMessages, errMsg];
      setMessages(finalMessages);
      if (convId) await api.agent.updateConversation(convId, { messages: finalMessages }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Conversation list */}
      <div style={{ width: 196, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-line-faint)', paddingRight: 8, gap: 4 }}>
        <button className="btn-primary" style={{ marginBottom: 8, fontSize: 12 }} onClick={newConversation}>
          ＋ 新對話
        </button>
        {loadingConvs ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}><Spinner size={14} /></div>
        ) : conversations.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--color-text-lo)', textAlign: 'center', paddingTop: 8 }}>尚無對話紀錄</div>
        ) : conversations.map((c) => (
          <div key={c.id} onClick={() => void selectConversation(c.id)} style={{
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
            background: activeId === c.id ? 'var(--color-signal-dim)' : 'transparent',
            color: activeId === c.id ? 'var(--color-signal-light)' : 'var(--color-text-mid)',
            border: activeId === c.id ? '1px solid var(--color-signal-border)' : '1px solid transparent',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.title}</span>
            <button onClick={(e) => void deleteConversation(c.id, e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-lo)', fontSize: 11, padding: 0, flexShrink: 0 }}>
              <Icon name="close" size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: 16, minWidth: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)', marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={18} /> AI 知識助手
        </h1>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
          {!activeId && messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--color-text-lo)', textAlign: 'center', padding: 32 }}>
              <div style={{ color: 'var(--color-text-lo)', opacity: 0.4 }}><Icon name="cpu" size={40} /></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-mid)' }}>詢問你的知識庫</div>
              <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.7 }}>直接輸入問題，或點左側選擇歷史對話</div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                background: msg.role === 'user' ? 'var(--color-signal-dim)' : msg.error ? 'rgba(240,80,104,0.08)' : 'var(--color-surf-1)',
                border: `1px solid ${msg.role === 'user' ? 'var(--color-signal-border)' : msg.error ? 'rgba(240,80,104,0.3)' : 'var(--color-circuit-border)'}`,
                borderLeft: msg.role === 'assistant' && !msg.error ? '3px solid var(--color-circuit)' : undefined,
                borderRadius: msg.role === 'user' ? 12 : '0 12px 12px 12px',
                padding: '10px 14px', fontSize: 13, color: 'var(--color-text-hi)', lineHeight: 1.7,
              }}>
                {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
              </div>

              {msg.webSources && msg.webSources.length > 0 && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-lo)', marginLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="globe" size={11} /> 網路資料</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {msg.webSources.filter((s) => s.web).map((s, si) => (
                      <a key={si} href={s.web!.uri} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: 11, padding: '4px 8px', background: 'var(--color-surf-2)',
                        border: '1px solid var(--color-line-faint)', borderRadius: 6,
                        color: 'var(--color-signal-light)', textDecoration: 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320,
                      }}>↗ {s.web!.title || s.web!.uri}</a>
                    ))}
                  </div>
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-lo)', marginLeft: 4 }}>引用 {msg.sources.length} 筆筆記</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {msg.sources.map((s, si) => (
                      <Link key={s.id} to={`/notes/${s.id}`} style={{
                        fontSize: 11, padding: '3px 8px', background: 'var(--color-surf-2)',
                        border: '1px solid var(--color-line-faint)', borderRadius: 6,
                        color: 'var(--color-text-mid)', textDecoration: 'none',
                      }}>[{si + 1}] {s.title ?? '無標題'}</Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: 'var(--color-surf-1)',
              border: '1px solid var(--color-circuit-border)', borderLeft: '3px solid var(--color-circuit)',
              borderRadius: '0 12px 12px 12px', fontSize: 12, color: 'var(--color-circuit-light)',
            }}>
              <Spinner size={12} color="var(--color-circuit-light)" /> 搜尋中…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--color-line-faint)', flexShrink: 0 }}>
          <input className="input-field" placeholder="問任何問題…" value={input}
            onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} disabled={loading} autoFocus />
          <button className="btn-primary" type="submit" disabled={loading || !input.trim()}>
            {loading ? <Spinner size={16} color="#fff" /> : '發送'}
          </button>
        </form>
      </div>
    </div>
  );
}
