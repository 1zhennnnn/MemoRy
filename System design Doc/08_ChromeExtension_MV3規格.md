# MemoRy — Chrome Extension MV3 規格

## 1. MV3 核心限制與對策

| MV3 限制 | 對策 |
|---------|------|
| 無持久 background page | 改用 Service Worker；token 存 `chrome.storage.local` |
| Service Worker 隨時被終止 | 每次喚醒先從 storage 還原狀態，不依賴記憶體 |
| 無法執行遠端程式碼 | 所有邏輯必須打包進 extension |
| CSP 限制 inline script | 不使用 `eval()`，不用 inline event handler |
| `chrome.identity` OAuth 限制 | Supabase Auth 改用 `chrome.identity.launchWebAuthFlow` |

---

## 2. 目錄結構

```
artifacts/chrome-ext/
├── manifest.json            ← v1.1.0：新增 sidePanel、alarms 權限
├── vite.config.ts
├── package.json
├── tsconfig.json
├── popup.html               ← Popup 入口（備用）
├── sidepanel.html           ← Side Panel 入口（主要）
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── src/
    ├── popup/
    │   ├── main.tsx
    │   ├── PopupApp.tsx
    │   ├── LoginView.tsx
    │   ├── MainView.tsx     ← 三個操作按鈕：整頁文字/截圖/重整
    │   └── components/
    │       ├── NoteRow.tsx
    │       ├── PixelCluster.tsx
    │       ├── StarDone.tsx
    │       └── TagBadge.tsx
    ├── sidepanel/           ← ★ 新增：Monica 側欄
    │   ├── main.tsx
    │   ├── SidePanelApp.tsx ← 登入判斷（複用 LoginView）
    │   └── SidePanelMainView.tsx ← 全高側欄主畫面
    ├── content/
    │   ├── index.tsx        ← content script 入口
    │   └── CaptureBar.tsx   ← 選取文字後浮動工具列
    ├── background/
    │   └── service-worker.ts ← 訊息路由 + API + token 刷新
    └── shared/
        ├── api.ts
        ├── auth.ts          ← token 管理（chrome.storage.local）
        ├── types.ts         ← 共用型別（含 SAVE_PAGE_TEXT）
        └── constants.ts
```

---

## 3. `manifest.json` 完整規格

```json
{
  "manifest_version": 3,
  "name": "MemoRy — AI 知識管理",
  "short_name": "MemoRy",
  "version": "1.0.0",
  "description": "AI 碎片化知識管理系統，自動摘要、標籤、語意搜尋",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    },
    "default_title": "MemoRy"
  },

  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.js"],
      "css": ["src/content/content.css"],
      "run_at": "document_idle",
      "exclude_matches": [
        "chrome://*/*",
        "chrome-extension://*/*",
        "about://*"
      ]
    }
  ],

  "permissions": [
    "activeTab",
    "contextMenus",
    "storage",
    "tabs",
    "scripting",
    "identity"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "web_accessible_resources": [
    {
      "resources": ["src/content/content.css", "icons/*"],
      "matches": ["<all_urls>"]
    }
  ],

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },

  "commands": {
    "save-selection": {
      "suggested_key": { "default": "Alt+Shift+S" },
      "description": "儲存目前選取的文字至 MemoRy"
    },
    "save-screenshot": {
      "suggested_key": { "default": "Alt+Shift+P" },
      "description": "截圖目前頁面並儲存至 MemoRy"
    }
  },

  "externally_connectable": {
    "matches": ["https://*.supabase.co/*"]
  }
}
```

**Permissions 說明**：
| Permission | 用途 |
|-----------|------|
| `activeTab` | 讀取目前頁面 URL、標題 |
| `contextMenus` | 右鍵選單「儲存至 MemoRy」 |
| `storage` | 儲存 JWT token、設定 |
| `tabs` | 截圖（`chrome.tabs.captureVisibleTab`） |
| `scripting` | 動態注入 content script |
| `identity` | Supabase OAuth 流程 |

---

## 4. `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: "manifest.json",
      additionalInputs: [
        "src/content/index.tsx",
        "src/background/service-worker.ts",
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "public/popup.html",
      },
    },
  },
  define: {
    "process.env.VITE_API_BASE_URL": JSON.stringify(
      process.env.VITE_API_BASE_URL ?? "http://localhost:5000"
    ),
    "process.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? ""
    ),
    "process.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ?? ""
    ),
  },
});
```

---

## 5. Supabase Auth 在 MV3 的整合方式

### 5.1 Token 儲存

MV3 Service Worker 無持久記憶體，必須用 `chrome.storage.local`：

```typescript
// src/shared/auth.ts

const TOKEN_KEY = "memory_auth_token";
const REFRESH_KEY = "memory_refresh_token";

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return result[TOKEN_KEY] ?? null;
}

export async function setToken(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]: accessToken,
    [REFRESH_KEY]: refreshToken,
  });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, REFRESH_KEY]);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  // 簡單檢查 JWT 是否過期
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
```

### 5.2 OAuth 登入流程（`chrome.identity.launchWebAuthFlow`）

```typescript
// src/background/service-worker.ts

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const REDIRECT_URL = chrome.identity.getRedirectURL("auth");

export async function loginWithGoogle(): Promise<void> {
  // 1. 建立 Supabase OAuth URL
  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", REDIRECT_URL);
  authUrl.searchParams.set("response_type", "token");

  // 2. 開啟 OAuth 視窗
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) throw new Error("OAuth 取消");

  // 3. 解析回傳的 token
  const url = new URL(responseUrl);
  const params = new URLSearchParams(url.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken) throw new Error("未收到 access_token");
  await setToken(accessToken, refreshToken ?? "");
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description ?? "登入失敗");
  }

  const data = await res.json();
  await setToken(data.access_token, data.refresh_token);
}
```

### 5.3 Token 自動刷新

```typescript
// 在 service-worker.ts 啟動時設定
async function refreshTokenIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get(["memory_auth_token", "memory_refresh_token"]);
  const { memory_auth_token: token, memory_refresh_token: refreshToken } = result;

  if (!token || !refreshToken) return;

  // 檢查是否快過期（提前 5 分鐘刷新）
  try {
    const [, payload] = token.split(".");
    const { exp } = JSON.parse(atob(payload));
    if (exp * 1000 - Date.now() > 5 * 60 * 1000) return; // 還有超過 5 分鐘
  } catch {
    return;
  }

  // 刷新 token
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (res.ok) {
    const data = await res.json();
    await setToken(data.access_token, data.refresh_token);
  }
}
```

---

## 6. Service Worker 訊息路由

```typescript
// src/background/service-worker.ts

// Popup → Background 訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // 保持 message channel 開啟（async response）
});

async function handleMessage(
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const token = await getToken();

  switch (message.type) {
    case "SAVE_TEXT":
      return saveTextNote(message.payload as SaveTextPayload, token!);

    case "SAVE_SCREENSHOT":
      return saveScreenshot(sender.tab!.id!, token!);

    case "GET_RECENT_NOTES":
      return getRecentNotes(token!);

    case "LOGIN_GOOGLE":
      return loginWithGoogle();

    case "LOGIN_EMAIL":
      return loginWithEmail(
        (message.payload as { email: string; password: string }).email,
        (message.payload as { email: string; password: string }).password
      );

    case "LOGOUT":
      return clearToken();

    case "CHECK_AUTH":
      return { isLoggedIn: await isLoggedIn() };

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
```

---

## 7. Content Script — CaptureBar 掛載邏輯

```typescript
// src/content/index.tsx

let captureBar: HTMLDivElement | null = null;

document.addEventListener("mouseup", (e) => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    removeCaptureBar();
    return;
  }
  const text = selection.toString().trim();
  if (text.length < 10) return; // 太短不顯示

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  showCaptureBar(text, rect, e);
});

function showCaptureBar(text: string, rect: DOMRect, event: MouseEvent): void {
  removeCaptureBar();
  // 動態掛載 React CaptureBar（避免與頁面衝突）
  const shadow = document.createElement("div");
  shadow.id = "memory-capture-bar";
  document.body.appendChild(shadow);

  // 計算位置（viewport 邊緣避讓）
  const top = Math.min(
    window.scrollY + rect.bottom + 8,
    window.scrollY + window.innerHeight - 200
  );
  const left = Math.min(
    window.scrollX + rect.left,
    window.scrollX + window.innerWidth - 340
  );

  shadow.style.cssText = `
    position: absolute; top: ${top}px; left: ${left}px;
    z-index: 2147483647; width: 320px;
  `;

  // React render
  import("./CaptureBar").then(({ default: CaptureBar }) => {
    ReactDOM.createRoot(shadow).render(
      <CaptureBar
        text={text}
        sourceUrl={window.location.href}
        sourceTitle={document.title}
        onClose={removeCaptureBar}
      />
    );
  });
  captureBar = shadow;
}

function removeCaptureBar(): void {
  if (captureBar) {
    captureBar.remove();
    captureBar = null;
  }
}
```

---

## 8. 右鍵選單設定

```typescript
// src/background/service-worker.ts

// 安裝時建立右鍵選單
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "memory-save-text",
    title: "💡 儲存至 MemoRy",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "memory-save-screenshot",
    title: "📷 截取螢幕截圖",
    contexts: ["page"],
  });
});

// 右鍵選單點擊處理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const token = await getToken();
  if (!token) {
    chrome.action.openPopup();
    return;
  }

  if (info.menuItemId === "memory-save-text" && info.selectionText) {
    await saveTextNote({
      sourceText: info.selectionText,
      sourceUrl: info.pageUrl,
      sourceTitle: tab?.title,
    }, token);
    // 通知 content script 顯示成功 Toast
    chrome.tabs.sendMessage(tab!.id!, { type: "SHOW_SUCCESS_TOAST" });
  }

  if (info.menuItemId === "memory-save-screenshot") {
    await saveScreenshot(tab!.id!, token);
    chrome.tabs.sendMessage(tab!.id!, { type: "SHOW_SUCCESS_TOAST" });
  }
});
```

---

## 9. 截圖實作

```typescript
// src/background/service-worker.ts

async function saveScreenshot(tabId: number, token: string): Promise<void> {
  // MV3 截圖 API
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
    format: "png",
    quality: 80,
  });

  // 取得頁面資訊
  const tab = await chrome.tabs.get(tabId);

  // 壓縮（若超過 10MB 需降品質）
  const base64 = dataUrl; // 已是 data:image/png;base64,...

  await apiPost("/api/notes/image", {
    imageBase64: base64,
    sourceUrl: tab.url,
    sourceTitle: tab.title,
  }, token);
}
```

---

## 10. API Client

```typescript
// src/shared/api.ts

const API_BASE = process.env.VITE_API_BASE_URL ?? "http://localhost:5000";

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token: string
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API error: ${res.status}`);
  }
  return res.json();
}
```

---

## 11. `package.json`（chrome-ext）

```json
{
  "name": "@workspace/chrome-ext",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.9.0",
    "vite": "^6.0.0",
    "vite-plugin-web-extension": "^4.1.0"
  }
}
```

---

## 12. 鍵盤快捷鍵

| 快捷鍵 | 指令 ID | 功能 |
|--------|---------|------|
| `Alt+Shift+S` | `save-selection` | 擷取目前選取的文字，若無選取則改為截圖 |
| `Alt+Shift+P` | `save-screenshot` | 截圖目前頁面並送至 API |

**Service Worker 實作**：

```typescript
// src/background/service-worker.ts

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === "save-selection") {
    // 嘗試取得選取文字
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() ?? "",
    });
    const selectedText = results?.[0]?.result ?? "";

    if (selectedText) {
      const token = await getToken();
      if (!token) return;
      await saveTextNote({
        sourceText: selectedText,
        sourceUrl: tab.url,
        sourceTitle: tab.title,
      }, token);
    } else {
      // 無選取 → 退回截圖
      await saveScreenshot(tab.id);
    }
  }

  if (command === "save-screenshot") {
    await saveScreenshot(tab.id);
  }
});
```

**注意**：`chrome.commands` 在 manifest 中宣告 `suggested_key`，使用者可在 `chrome://extensions/shortcuts` 自訂。

---

## 13. 常見 MV3 踩坑

| 問題 | 原因 | 解決方式 |
|------|------|---------|
| Service Worker 失活後 token 消失 | 記憶體狀態不持久 | 每次操作前 `await getToken()` 從 storage 取 |
| `chrome.identity` 在非 HTTPS 域無法使用 | MV3 安全限制 | 開發時用 `chrome://extensions` 側載，production 需 HTTPS |
| Content script 注入 React 後樣式衝突 | 全域 CSS 污染 | 使用 Shadow DOM 或 CSS Module + 高特異性選擇器 |
| `fetch` 在 service worker 中逾時 | SW 存活時間有限（5 分鐘） | API 呼叫加 `keepalive: true`；大型操作拆分 |
| `chrome.tabs.captureVisibleTab` 需要 `activeTab` | 權限問題 | manifest 已包含，但需要用戶主動觸發（不能在背景自動截圖） |
