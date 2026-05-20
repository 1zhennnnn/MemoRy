import { api } from './api';
import type { NoteCard, DailyReport } from './types';

// ── Graph cache ───────────────────────────────────────────────────────────────
type GraphData = Awaited<ReturnType<typeof api.graph.get>>;
let graphCache: GraphData | null = null;
export const graphData = {
  get: () => graphCache,
  set: (v: GraphData) => { graphCache = v; },
  invalidate: () => { graphCache = null; },
};

// ── Timeline cache ────────────────────────────────────────────────────────────
interface TimelineCache { notes: NoteCard[]; totalPages: number; }
let timelineCache: TimelineCache | null = null;
export const timeline = {
  get: () => timelineCache,
  set: (v: TimelineCache) => { timelineCache = v; },
  prefetch: () => {
    if (timelineCache) return;
    void api.notes.list({ page: 1, limit: 20 }).then((r) => {
      timelineCache = { notes: r.notes, totalPages: Math.ceil(r.total / 20) };
    }).catch(() => {});
  },
};

// ── Reports cache ─────────────────────────────────────────────────────────────
let reportsCache: DailyReport[] | null = null;
export const reports = {
  get: () => reportsCache,
  set: (v: DailyReport[]) => { reportsCache = v; },
  prefetch: () => {
    if (reportsCache) return;
    void api.reports.list().then((r) => { reportsCache = r; }).catch(() => {});
  },
};
