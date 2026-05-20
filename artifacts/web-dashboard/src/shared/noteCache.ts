import { api } from './api';
import type { NoteDetail } from './types';

// Simple LRU-ish cache: keep latest 50 notes in memory
const cache = new Map<string, NoteDetail>();
const MAX = 50;

export function getCached(id: string): NoteDetail | undefined {
  return cache.get(id);
}

export function setCached(id: string, note: NoteDetail): void {
  if (cache.size >= MAX) {
    // Evict the oldest entry
    cache.delete(cache.keys().next().value!);
  }
  cache.set(id, note);
}

export function prefetch(id: string): void {
  if (cache.has(id)) return;
  void api.notes.get(id).then((note) => setCached(id, note)).catch(() => {});
}
