import React, { useEffect, useState } from "react";
import type { NoteCard, Message } from "../shared/types.js";
import NoteRow from "./components/NoteRow.js";

interface MainViewProps {
  onLogout: () => void;
}

export default function MainView({ onLogout }: MainViewProps) {
  const [notes, setNotes]       = useState<NoteCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [pageState, setPageState] = useState<"idle"|"saving"|"done"|"error">("idle");

  useEffect(() => {
    void loadRecentNotes();
  }, []);

  async function loadRecentNotes() {
    setLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_RECENT_NOTES" }) as { notes?: NoteCard[] };
      setNotes(res.notes ?? []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCurrentPage() {
    setSaving(true); setSaved(false);
    try {
      const msg: Message = { type: "SAVE_SCREENSHOT" };
      await chrome.runtime.sendMessage(msg);
      setSaved(true);
      setTimeout(() => { setSaved(false); void loadRecentNotes(); }, 1500);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleSavePageText() {
    setPageState("saving");
    try {
      const res = await chrome.runtime.sendMessage({ type: "SAVE_PAGE_TEXT" }) as { error?: string };
      if (res?.error) throw new Error(res.error);
      setPageState("done");
      setTimeout(() => { setPageState("idle"); void loadRecentNotes(); }, 1800);
    } catch {
      setPageState("error");
      setTimeout(() => setPageState("idle"), 2500);
    }
  }

  async function handleLogout() {
    const msg: Message = { type: "LOGOUT" };
    await chrome.runtime.sendMessage(msg);
    onLogout();
  }

  const headerStyle: React.CSSProperties = {
    padding: "12px 16px",
    borderBottom: "1px solid #1A2035",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img src="icons/icon16.png" alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: "14px", color: "#DFE4F0" }}>MemoRy</span>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: "none", border: "none", color: "#4A5272", cursor: "pointer", fontSize: "11px" }}
        >
          登出
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1A2035" }}>
        <input
          type="text"
          placeholder="搜尋筆記…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", padding: "7px 12px",
            background: "#161A28", border: "1px solid #2A3555",
            borderRadius: "6px", color: "#DFE4F0", fontSize: "12px", outline: "none",
          }}
        />
      </div>

      {/* Recent Notes */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#4A5272", fontSize: "12px" }}>載入中…</div>
        ) : notes.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#4A5272", fontSize: "12px" }}>還沒有筆記</div>
        ) : (
          notes
            .filter((n) => !query || (n.aiTitle ?? "").includes(query) || (n.aiSummary ?? "").includes(query))
            .map((note) => <NoteRow key={note.id} note={note} />)
        )}
      </div>

      {/* Action Bar */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid #1A2035", display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={handleSavePageText}
            disabled={pageState === "saving"}
            style={{
              flex: 1, padding: "8px 6px",
              background: pageState === "done" ? "#1A3A2A" : pageState === "error" ? "#2A1020" : "#161A28",
              border: `1px solid ${pageState === "done" ? "#34D4A8" : pageState === "error" ? "#F05068" : "#2A3555"}`,
              borderRadius: "7px",
              color: pageState === "done" ? "#34D4A8" : pageState === "error" ? "#F05068" : "#DFE4F0",
              fontSize: "11px", cursor: "pointer",
            }}
          >
            {pageState === "saving" ? "擷取中…" : pageState === "done" ? "✦ 已擷取" : pageState === "error" ? "失敗" : "📄 整頁文字"}
          </button>
          <button
            onClick={handleSaveCurrentPage}
            disabled={saving}
            style={{
              flex: 1, padding: "8px 6px",
              background: saved ? "#1A3A2A" : "#161A28",
              border: `1px solid ${saved ? "#34D4A8" : "#2A3555"}`,
              borderRadius: "7px", color: saved ? "#34D4A8" : "#DFE4F0",
              fontSize: "11px", cursor: "pointer",
            }}
          >
            {saved ? "✦ 已截圖" : saving ? "截圖中…" : "📷 截圖"}
          </button>
          <button
            onClick={loadRecentNotes}
            style={{
              padding: "8px 10px", background: "#161A28", border: "1px solid #2A3555",
              borderRadius: "7px", color: "#8A96B2", fontSize: "12px", cursor: "pointer", flexShrink: 0,
            }}
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}
