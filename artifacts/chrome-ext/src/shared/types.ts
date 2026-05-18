export interface NoteCard {
  id: string;
  aiTitle: string | null;
  aiSummary: string | null;
  tags: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  noteType: "text" | "image";
  aiStatus: "pending" | "done" | "failed";
  createdAt: string;
}

export interface SaveTextPayload {
  sourceText: string;
  sourceUrl?: string;
  sourceTitle?: string;
  userNote?: string;
}

export type MessageType =
  | "SAVE_TEXT"
  | "SAVE_SCREENSHOT"
  | "SAVE_PAGE_TEXT"
  | "GET_RECENT_NOTES"
  | "LOGIN_GOOGLE"
  | "LOGIN_EMAIL"
  | "LOGOUT"
  | "CHECK_AUTH"
  | "SHOW_SUCCESS_TOAST";

export interface Message {
  type: MessageType;
  payload?: unknown;
}
