export type AiStatus = 'pending' | 'done' | 'failed';
export type NoteType = 'text' | 'image';

export interface NoteCard {
  id: string;
  aiTitle: string | null;
  aiSummary: string | null;
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
