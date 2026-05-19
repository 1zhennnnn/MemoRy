import { getAccessToken, logout } from './auth';
import type {
  NoteCard, NoteDetail, NoteListResponse,
  TagItem, DailyReport, SearchResponse,
  KeywordSearchResponse, ReportsListResponse,
} from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000';

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
    logout();
    throw new Error('登入已過期，請重新登入');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '請求失敗' })) as { message?: string };
    throw new Error(err.message ?? '請求失敗');
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
    patch: (id: string, body: { userNote?: string; tags?: string[] }) =>
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
    generate: () => request<DailyReport>('/reports/generate', { method: 'POST' }),
    delete: (date: string) => request<void>(`/reports/${date}`, { method: 'DELETE' }),
    patch: (date: string, diaryText: string) =>
      request<{ reportDate: string }>(`/reports/${date}/diary`, { method: 'PATCH', body: JSON.stringify({ diaryText }) }),
  },

  tags: {
    list: () => request<TagItem[]>('/tags'),
  },

  export: {
    url: (format: 'json' | 'markdown') => {
      const token = getAccessToken();
      return `${API_BASE}/api/export?format=${format}&token=${token ?? ''}`;
    },
  },
};
