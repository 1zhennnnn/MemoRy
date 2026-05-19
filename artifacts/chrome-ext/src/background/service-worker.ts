import {
  getToken, clearToken, isLoggedIn,
  loginWithGoogle, loginWithEmail, refreshTokenIfNeeded,
} from "../shared/auth.js";
import { apiGet, apiPost } from "../shared/api.js";
import type { NoteCard, SaveTextPayload, Message } from "../shared/types.js";

// ── 安裝時初始化 ──────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Side panel：點擊 action icon 直接開啟，取代 popup
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  // 每 45 分鐘自動刷新 token，避免登出
  chrome.alarms.create("token-refresh", { periodInMinutes: 45 });

  chrome.contextMenus.create({
    id: "memory-save-text",
    title: "💡 儲存選取文字至 MemoRy",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "memory-save-page",
    title: "📄 擷取整頁文字至 MemoRy",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "memory-save-screenshot",
    title: "🔗 書籤儲存至 MemoRy",
    contexts: ["page"],
  });
});

// ── Token 定時刷新 ────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "token-refresh") void refreshTokenIfNeeded();
});

// ── 右鍵選單 ─────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    const token = await getToken();
    if (!token) { if (tab?.windowId) void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {}); return; }

    if (info.menuItemId === "memory-save-text" && info.selectionText) {
      await saveTextNote({ sourceText: info.selectionText, sourceUrl: info.pageUrl, sourceTitle: tab?.title }, token);
      if (tab?.id) showToastInTab(tab.id, "✦ 已儲存選取文字");
    }
    if (info.menuItemId === "memory-save-page" && tab?.id) {
      await savePageText(tab.id, token);
      showToastInTab(tab.id, "✦ 已擷取整頁文字");
    }
    if (info.menuItemId === "memory-save-screenshot" && tab) {
      await saveBookmark(tab, token);
      if (tab.id) showToastInTab(tab.id, "✦ 已加入書籤");
    }
  })();
});

// ── 鍵盤快捷鍵 ───────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    const token = await getToken();
    if (!token) { const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (activeTab?.windowId) void chrome.sidePanel.open({ windowId: activeTab.windowId }).catch(() => {}); return; }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (command === "save-selection") {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString().trim() ?? "",
      });
      const selectedText = results[0]?.result ?? "";
      if (selectedText) {
        await saveTextNote({ sourceText: selectedText, sourceUrl: tab.url, sourceTitle: tab.title }, token);
        showToastInTab(tab.id, "✦ 已儲存選取文字");
      } else {
        // 無選取 → 截圖代替
        await saveScreenshot(tab.id, token);
        showToastInTab(tab.id, "✦ 已截圖儲存");
      }
    }

    if (command === "save-screenshot") {
      await saveBookmark(tab, token);
      showToastInTab(tab.id, "✦ 已加入書籤");
    }

    if (command === "save-page") {
      await savePageText(tab.id, token);
      showToastInTab(tab.id, "✦ 已擷取整頁文字");
    }
  })();
});

// ── 訊息路由 ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ error: err.message }));
    return true;
  },
);

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case "CHECK_AUTH": {
      // 每次檢查都先刷新，確保長時間不操作後仍保持登入
      await refreshTokenIfNeeded();
      return { isLoggedIn: await isLoggedIn() };
    }

    case "SAVE_TEXT": {
      const token = await getToken();
      if (!token) throw new Error("未登入");
      return saveTextNote(message.payload as SaveTextPayload, token);
    }

    case "SAVE_SCREENSHOT": {
      const token = await getToken();
      if (!token) throw new Error("未登入");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("找不到目前分頁");
      return saveBookmark(tab, token);
    }

    case "SAVE_PAGE_TEXT": {
      const token = await getToken();
      if (!token) throw new Error("未登入");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("找不到目前分頁");
      return savePageText(tab.id, token);
    }

    case "GET_RECENT_NOTES": {
      const token = await getToken();
      if (!token) return { notes: [] };
      return apiGet<{ notes: NoteCard[] }>("/api/notes?page=1&limit=10", token);
    }

    case "LOGIN_GOOGLE":
      return loginWithGoogle();

    case "LOGIN_EMAIL": {
      const { email, password } = message.payload as { email: string; password: string };
      return loginWithEmail(email, password);
    }

    case "LOGOUT":
      return clearToken();

    default:
      throw new Error(`Unknown message type: ${String((message as Message).type)}`);
  }
}

// ── 操作函式 ─────────────────────────────────────────────────────
async function saveTextNote(payload: SaveTextPayload, token: string): Promise<unknown> {
  return apiPost("/api/notes/text", payload, token);
}

async function savePageText(tabId: number, token: string): Promise<unknown> {
  // 直接在頁面讀取 innerText（不 clone，clone 的離線 node 無法呼叫 innerText）
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const text = document.body.innerText ?? "";
      // 補充圖片 alt text
      const alts = Array.from(document.querySelectorAll("img"))
        .map((img) => img.getAttribute("alt")?.trim())
        .filter((a): a is string => Boolean(a));
      const altBlock = alts.length > 0 ? `\n\n[頁面圖片描述: ${alts.join(" / ")}]` : "";
      return (text + altBlock).replace(/\n{3,}/g, "\n\n").trim();
    },
  });
  const pageText = (results[0]?.result ?? "") as string;
  if (!pageText) throw new Error("無法擷取頁面內容（可能是受保護頁面或空白頁）");

  const tab = await chrome.tabs.get(tabId);
  return saveTextNote({
    sourceText: pageText,
    sourceUrl:  tab.url,
    sourceTitle: tab.title,
  }, token);
}

async function saveBookmark(tab: chrome.tabs.Tab, token: string): Promise<unknown> {
  return apiPost("/api/notes/bookmark", {
    sourceUrl:   tab.url,
    sourceTitle: tab.title,
  }, token);
}

// 用 executeScript 直接注入 toast，不依賴 content script 是否已載入
function showToastInTab(tabId: number, msg: string): void {
  void chrome.scripting.executeScript({
    target: { tabId },
    func: (text: string) => {
      const existing = document.getElementById("memory-toast");
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.id = "memory-toast";
      toast.textContent = text;
      toast.style.cssText = [
        "position:fixed", "bottom:24px", "right:24px",
        "background:#0F1219", "border:1px solid #34D4A8",
        "border-radius:8px", "padding:10px 18px",
        "color:#34D4A8", "font-size:13px",
        "z-index:2147483647", "pointer-events:none",
        "font-family:system-ui,sans-serif",
        "box-shadow:0 4px 20px rgba(0,0,0,0.5)",
        "animation:memory-fadein 0.2s ease",
      ].join(";");
      const style = document.createElement("style");
      style.textContent = "@keyframes memory-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}";
      document.head.appendChild(style);
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
    args: [msg],
  }).catch(() => {});
}

export {};
