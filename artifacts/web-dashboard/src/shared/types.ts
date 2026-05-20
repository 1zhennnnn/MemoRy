export type AiStatus = 'pending' | 'done' | 'failed';

export interface Highlight { start: number; end: number; color: string; }
export type NoteType = 'text' | 'image' | 'bookmark' | 'page';

export interface NoteCard {
  id: string;
  aiTitle: string | null;
  aiSummary: string | null;
  userNote: string | null;
  aiStatus: AiStatus;
  tags: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  noteType: NoteType;
  createdAt: string;
}

export interface NoteDetail extends NoteCard {
  sourceText: string | null;
  ocrText: string | null;
  userNote: string | null;
  highlights: Highlight[];
  relatedNotes: NoteCard[];
}

export interface NoteListResponse {
  notes: NoteCard[];
  total: number;
  page: number;
  limit: number;
}

export interface TagItem {
  name: string;
  useCount: number;
}

export interface DailyReport {
  reportDate: string;
  noteCount: number;
  keyLearnings: string[];
  crossDomain: string | null;
  suggestions: string[];
  diaryText: string | null;
  relatedNotes?: NoteCard[];
}

export interface SearchResponse {
  answer: string;
  sources: NoteCard[];
}

export interface KeywordSearchResponse {
  notes: NoteCard[];
  total: number;
  page: number;
  limit: number;
}

export interface ReportsListResponse {
  reports: DailyReport[];
  total: number;
}
