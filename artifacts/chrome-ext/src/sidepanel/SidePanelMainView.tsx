import React, { useEffect, useState } from "react";
import type { NoteCard, Message } from "../shared/types.js";
import NoteRow from "../popup/components/NoteRow.js";

interface Props { onLogout: () => void; onNeedRelogin: () => void; }

type ActionState = "idle" | "saving" | "done" | "error";

export default function SidePanelMainView({ onLogout, onNeedRelogin }: Props) {
  const [notes, setNotes]     = useState<NoteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState("");
  const [screenshotState, setScreenshotState] = useState<ActionState>("idle");
  const [pageTextState, setPageTextState]     = useState<ActionState>("idle");
  const [lastError, setLastError]             = useState<string | null>(null);

  useEffect(() => {
    void loadNotes();
    window.addEventListener('focus', loadNotes);
    return () => window.removeEventListener('focus', loadNotes);
  }, []);

  async function loadNotes() {
    setLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_RECENT_NOTES" }) as { notes?: NoteCard[]; error?: string };
      if (res.error) throw new Error(res.error);
      setNotes(res.notes ?? []);
    } catch { setNotes([]); }
    finally { setLoading(false); }
  }

  async function runAction(
    msgType: "SAVE_SCREENSHOT" | "SAVE_PAGE_TEXT",
    setState: (s: ActionState) => void,
  ) {
    setState("saving");
    setLastError(null);
    try {
      const res = await chrome.runtime.sendMessage({ type: msgType }) as { error?: string } | undefined;
      if (res?.error) throw new Error(res.error);
      if (!res) throw new Error("background 無回應，請重新載入擴充功能");
      setState("done");
      setTimeout(() => { setState("idle"); void loadNotes(); }, 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // token 遺失或過期 → 直接跳回登入頁讓使用者重新登入
      if (msg.includes("未登入") || msg.includes("401")) {
        onNeedRelogin();
        return;
      }
      setLastError(msg);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  async function handleLogout() {
    const msg: Message = { type: "LOGOUT" };
    await chrome.runtime.sendMessage(msg);
    onLogout();
  }

  const filtered = notes.filter(
    (n) => !query || (n.aiTitle ?? "").includes(query) || (n.aiSummary ?? "").includes(query),
  );

  const actionBtn = (
    label: string,
    state: ActionState,
    onIdle: () => void,
    doneLabel: string,
  ) => (
    <button
      onClick={state === "idle" ? onIdle : undefined}
      disabled={state === "saving"}
      style={{
        flex: 1, padding: "9px 8px", fontSize: "12px", cursor: "pointer",
        borderRadius: "7px", border: "1px solid",
        ...(state === "done"
          ? { background: "#1A3A2A", borderColor: "#34D4A8", color: "#34D4A8" }
          : state === "error"
          ? { background: "#2A1020", borderColor: "#F05068", color: "#F05068" }
          : { background: "#161A28", borderColor: "#2A3555", color: "#DFE4F0" }),
      }}
    >
      {state === "saving" ? "處理中…" : state === "done" ? doneLabel : state === "error" ? "失敗，重試" : label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #1A2035",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="icons/icon48.png" alt="" style={{ width: 80, height: 44, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: "15px", color: "#DFE4F0" }}>MemoRy</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#5B7AE0", fontSize: "11px", textDecoration: "none" }}
          >
            開啟 Dashboard ↗
          </a>
          <button
            onClick={handleLogout}
            style={{ background: "none", border: "none", color: "#4A5272", cursor: "pointer", fontSize: "11px" }}
          >
            登出
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1A2035", flexShrink: 0 }}>
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
        ) : filtered.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#4A5272", fontSize: "12px" }}>
            {query ? "無符合筆記" : "還沒有筆記，試試下方按鈕儲存當前頁面"}
          </div>
        ) : (
          filtered.map((note) => <NoteRow key={note.id} note={note} />)
        )}
      </div>

      {/* Action Bar */}
      <div style={{
        padding: "10px 16px", borderTop: "1px solid #1A2035",
        display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {actionBtn(
            "📄 擷取整頁文字", pageTextState,
            () => runAction("SAVE_PAGE_TEXT", setPageTextState),
            "✦ 已擷取",
          )}
          {actionBtn(
            "🔗 快速書籤", screenshotState,
            () => runAction("SAVE_SCREENSHOT", setScreenshotState),
            "✦ 已書籤",
          )}
          <button
            onClick={() => void loadNotes()}
            style={{
              padding: "9px 12px", background: "#161A28", border: "1px solid #2A3555",
              borderRadius: "7px", color: "#8A96B2", fontSize: "12px", cursor: "pointer", flexShrink: 0,
            }}
          >
            ↻
          </button>
        </div>
        <div style={{ fontSize: "10px", color: "#4A5272", textAlign: "center" }}>
          Alt+Shift+S 選取 ・ Alt+Shift+P 書籤 ・ Alt+Shift+A 整頁
        </div>
        {lastError && (
          <div style={{
            fontSize: "11px", color: "#F05068",
            background: "rgba(240,80,104,0.08)", border: "1px solid rgba(240,80,104,0.3)",
            borderRadius: "6px", padding: "6px 10px",
            wordBreak: "break-all",
          }}>
            ⚠ {lastError}
            {lastError.includes("fetch") && (
              <div style={{ marginTop: 4, color: "#8A96B2" }}>
                請確認 API Server 已啟動：<br />
                <code style={{ color: "#F0A030" }}>pnpm --filter @workspace/api-server run dev</code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
