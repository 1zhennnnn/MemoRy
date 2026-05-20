import React, { useEffect, useState } from "react";
import type { NoteCard, Message } from "../shared/types.js";
import NoteRow from "../popup/components/NoteRow.js";
import { useExtTheme, DASHBOARD_URL } from "../shared/theme.js";

interface Props { onLogout: () => void; onNeedRelogin: () => void; }

type ActionState = "idle" | "saving" | "done" | "error";

export default function SidePanelMainView({ onLogout, onNeedRelogin }: Props) {
  const { colors, theme, toggle } = useExtTheme();
  const [notes, setNotes]     = useState<NoteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState("");
  const [pageTextState, setPageTextState] = useState<ActionState>("idle");
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
      if (msg.includes("未登入") || msg.includes("401")) {
        onNeedRelogin();
        return;
      }
      setLastError(msg);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  async function openDashboard(path = "") {
    const stored = await chrome.storage.local.get(["memory_auth_token", "memory_refresh_token"]);
    const accessToken  = stored["memory_auth_token"]  as string | undefined;
    const refreshToken = stored["memory_refresh_token"] as string | undefined;
    let hash = "";
    if (accessToken) {
      hash = `#ext_token=${encodeURIComponent(accessToken)}`;
      if (refreshToken) hash += `&ext_refresh=${encodeURIComponent(refreshToken)}`;
    }
    const url = `${DASHBOARD_URL}${path}${hash}`;
    const existing = await chrome.tabs.query({ url: `${DASHBOARD_URL}/*` });
    if (existing.length > 0 && existing[0]!.id != null) {
      await chrome.tabs.update(existing[0]!.id, { url, active: true });
      if (existing[0]!.windowId != null) {
        void chrome.windows.update(existing[0]!.windowId, { focused: true });
      }
    } else {
      void chrome.tabs.create({ url });
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
          ? { background: theme === "dark" ? "#1A3A2A" : "#E6F7F3", borderColor: colors.done, color: colors.done }
          : state === "error"
          ? { background: theme === "dark" ? "#2A1020" : "#FDEDEF", borderColor: colors.failed, color: colors.failed }
          : { background: colors.surf2, borderColor: colors.borderSub, color: colors.textHi }),
      }}
    >
      {state === "saving" ? "處理中…" : state === "done" ? doneLabel : state === "error" ? "失敗，重試" : label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: colors.bg }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        background: colors.surf1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="icons/icon48.png" alt="" style={{ width: 80, height: 44, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: "15px", color: colors.textHi }}>MemoRy</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === "dark" ? "切換亮色模式" : "切換暗色模式"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "15px", lineHeight: 1, padding: "2px 4px",
              color: colors.textMid,
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => { void openDashboard(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.signal, fontSize: "11px", padding: 0 }}
          >
            開啟 Dashboard ↗
          </button>
          <button
            onClick={handleLogout}
            style={{ background: "none", border: "none", color: colors.textLo, cursor: "pointer", fontSize: "11px" }}
          >
            登出
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}`, flexShrink: 0, background: colors.surf1 }}>
        <input
          type="text"
          placeholder="搜尋筆記…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", padding: "7px 12px",
            background: colors.inputBg, border: `1px solid ${colors.borderSub}`,
            borderRadius: "6px", color: colors.textHi, fontSize: "12px", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Recent Notes */}
      <div style={{ flex: 1, overflowY: "auto", background: colors.bg }}>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: colors.textLo, fontSize: "12px" }}>載入中…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: colors.textLo, fontSize: "12px" }}>
            {query ? "無符合筆記" : "還沒有筆記，試試下方按鈕儲存當前頁面"}
          </div>
        ) : (
          filtered.map((note) => <NoteRow key={note.id} note={note} />)
        )}
      </div>

      {/* Action Bar */}
      <div style={{
        padding: "10px 16px", borderTop: `1px solid ${colors.border}`,
        display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0,
        background: colors.surf1,
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {actionBtn(
            "📄 擷取整頁文字", pageTextState,
            () => runAction("SAVE_PAGE_TEXT", setPageTextState),
            "✦ 已擷取",
          )}
          <button
            onClick={() => void loadNotes()}
            style={{
              padding: "9px 12px", background: colors.surf2, border: `1px solid ${colors.borderSub}`,
              borderRadius: "7px", color: colors.textMid, fontSize: "12px", cursor: "pointer", flexShrink: 0,
            }}
          >
            ↻
          </button>
        </div>
        <div style={{ fontSize: "10px", color: colors.textLo, textAlign: "center" }}>
          Alt+Shift+S 選取 ・ Alt+Shift+A 整頁
        </div>
        {lastError && (
          <div style={{
            fontSize: "11px", color: colors.failed,
            background: theme === "dark" ? "rgba(240,80,104,0.08)" : "rgba(208,48,80,0.08)",
            border: `1px solid ${colors.failed}4D`,
            borderRadius: "6px", padding: "6px 10px",
            wordBreak: "break-all",
          }}>
            ⚠ {lastError}
          </div>
        )}
      </div>
    </div>
  );
}
