import { getAccessToken, logout, refreshAccessToken } from './auth';
import type {
  NoteCard, NoteDetail, NoteListResponse,
  TagItem, DailyReport, SearchResponse,
  KeywordSearchResponse, ReportsListResponse,
} from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? (import.meta.env.PROD ? 'https://memory-hylv.onrender.com' : 'http://localhost:5000');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    // Try refreshing the access token before giving up
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the original request with the new token
      const retryRes = await fetch(`${API_BASE}/api${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
          ...(options?.headers ?? {}),
        },
      });
      if (retryRes.ok) {
        if (retryRes.status === 204) return undefined as T;
        return retryRes.json() as Promise<T>;
      }
    }
    logout();
    throw new Error('登入已過期，請重新登入');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string; error?: { message?: string } };
    const msg = body.message ?? body.error?.message ?? `請求失敗 (${res.status})`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface NotesListParams {
  page?: number;
  limit?: number;
  tag?: string;
  type?: 'notes' | 'bookmarks';
}

export const healthz = () =>
  fetch(`${API_BASE}/api/healthz`).then((r) => r.ok).catch(() => false);

export const api = {
  notes: {
    list: (params?: NotesListParams) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.tag) q.set('tag', params.tag);
      if (params?.type) q.set('type', params.type);
      return request<NoteListResponse>(`/notes?${q.toString()}`);
    },
    createBookmark: (body: { sourceUrl: string; sourceTitle?: string; userNote?: string }) =>
      request<{ noteId: string; aiStatus: string }>('/notes/bookmark', { method: 'POST', body: JSON.stringify(body) }),
    get: (id: string) => request<NoteDetail>(`/notes/${id}`),
    createText: (body: { sourceText: string; sourceUrl?: string; sourceTitle?: string; userNote?: string }) =>
      request<{ noteId: string; aiStatus: string }>('/notes/text', { method: 'POST', body: JSON.stringify(body) }),
    createImage: (body: { imageBase64: string; sourceUrl?: string; sourceTitle?: string; userNote?: string }) =>
      request<{ noteId: string; aiStatus: string }>('/notes/image', { method: 'POST', body: JSON.stringify(body) }),
    patch: (id: string, body: { aiTitle?: string; aiSummary?: string; userNote?: string; tags?: string[]; highlights?: Array<{ start: number; end: number; color: string }> }) =>
      request<{ noteId: string; reembedding: boolean }>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
    retryAi: (id: string) => request<{ noteId: string; aiStatus: string }>(`/notes/${id}/retry-ai`, { method: 'POST' }),
  },

  search: {
    semantic: (query: string) =>
      request<SearchResponse>('/search', { method: 'POST', body: JSON.stringify({ query }) }),
    keyword: (q: string) =>
      request<KeywordSearchResponse>(`/search/keyword?q=${encodeURIComponent(q)}`),
  },

  reports: {
    list: () => request<ReportsListResponse>('/reports').then((r) => r.reports),
    get: (date: string) => request<DailyReport>(`/reports/${date}`),
    getRelated: (date: string) => request<{ relatedNotes: DailyReport['relatedNotes'] }>(`/reports/${date}/related`),
    generate: () => request<DailyReport>('/reports/generate', { method: 'POST' }),
    delete: (date: string) => request<void>(`/reports/${date}`, { method: 'DELETE' }),
    patch: (date: string, diaryText: string) =>
      request<{ reportDate: string }>(`/reports/${date}/diary`, { method: 'PATCH', body: JSON.stringify({ diaryText }) }),
  },

  tags: {
    list: () => request<TagItem[]>('/tags'),
  },

  agent: {
    chat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
      request<{
        answer: string;
        sources: Array<{ id: string; title: string | null; summary: string | null; score?: number }>;
        webSources: Array<{ web?: { uri: string; title: string } }>;
        toolCalls: number;
      }>('/agent/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
    listConversations: () =>
      request<Array<{ id: string; title: string; updatedAt: string }>>('/agent/conversations'),
    getConversation: (id: string) =>
      request<{ id: string; title: string; messages: unknown[]; updatedAt: string }>(`/agent/conversations/${id}`),
    createConversation: (title?: string) =>
      request<{ id: string; title: string }>('/agent/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
    updateConversation: (id: string, body: { messages?: unknown[]; title?: string }) =>
      request<{ id: string }>(`/agent/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteConversation: (id: string) =>
      request<void>(`/agent/conversations/${id}`, { method: 'DELETE' }),
  },

  graph: {
    get: () => request<{
      nodes: Array<{ id: string; title: string | null; summary: string | null; tags: string[] }>;
      edges: Array<{ source: string; target: string; type: 'tag' | 'semantic'; weight: number }>;
    }>('/graph'),
  },

  export: {
    url: (format: 'json' | 'markdown') => {
      const token = getAccessToken();
      return `${API_BASE}/api/export?format=${format}&token=${token ?? ''}`;
    },
  },
};
