# MemoRy

AI 碎片化知識管理系統 — 隨手擷取網頁內容，自動摘要、標籤、向量搜尋。

## 功能

- **Chrome Extension**：選取文字、整頁擷取、截圖 OCR，快捷鍵一鍵儲存，側欄模式
- **Web Dashboard**：時間軸瀏覽、語意搜尋（RAG）、AI 日報、暗/亮主題
- **新增筆記**：文字輸入、圖片上傳（OCR）、批次輸入（多篇同時送出）
- **AI 自動處理**：摘要、標籤、向量嵌入、失敗可重新處理
- **Supabase 驗證**：Google OAuth + Email 登入

## 架構

```
MemoRy/
├── artifacts/
│   ├── api-server/     # Express 5 API（Node.js）
│   ├── web-dashboard/  # React + Vite 前端
│   └── chrome-ext/     # Chrome Extension MV3
└── lib/
    ├── db/             # Drizzle ORM + Neon PostgreSQL
    ├── api-spec/       # OpenAPI 契約
    └── api-zod/        # Zod schema（codegen）
```

## AI 模型配置

| 功能 | 模型 | 供應商 |
|------|------|------|
| 文字摘要 / 標籤 / 日報 / RAG | `llama-3.3-70b-versatile` | [Groq](https://console.groq.com) |
| 圖片 OCR | `gemini-2.5-flash` | Google |
| 向量嵌入（3072 維） | `gemini-embedding-2` | Google |

## 快速開始

### 環境需求

- Node.js 20+
- pnpm 9+
- PostgreSQL（含 pgvector）或 [Neon](https://neon.tech) 免費方案

### 安裝

```bash
git clone https://github.com/1zhennnnn/MemoRy.git
cd MemoRy
pnpm install
```

### 設定環境變數

```bash
cp .env.example artifacts/api-server/.env
# 編輯填入實際值
```

必填：
| 變數 | 說明 | 取得方式 |
|------|------|---------|
| `DATABASE_URL` | PostgreSQL 連線字串 | [Neon](https://neon.tech) |
| `SUPABASE_URL` | Supabase Project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_JWT_SECRET` | JWT 驗證金鑰 | Supabase Dashboard → Settings → API → JWT Secret |
| `GROQ_API_KEY` | Groq API Key | [console.groq.com](https://console.groq.com) |
| `GEMINI_API_KEY` | Google AI API Key | [Google AI Studio](https://aistudio.google.com) |

### 啟用 pgvector 並推送 Schema

```sql
-- 在 Neon / PostgreSQL 執行
CREATE EXTENSION IF NOT EXISTS vector;
```

```bash
pnpm --filter @workspace/db run push
# 出現提示時選 Yes（首次建立或升級向量維度時需清空舊資料）
```

### 啟動開發伺服器

```bash
# API Server（port 5000）
pnpm --filter @workspace/api-server run dev

# Web Dashboard（port 3000）
pnpm --filter @workspace/web-dashboard run dev

# 同時啟動兩者
pnpm run dev:all
```

### 載入 Chrome Extension

```bash
pnpm --filter @workspace/chrome-ext run build
```

Chrome → `chrome://extensions` → 開啟開發者模式 → 載入未封裝項目 → 選 `artifacts/chrome-ext/dist/`

**快捷鍵**
| 快捷鍵 | 動作 |
|--------|------|
| `Alt+Shift+S` | 儲存選取文字 |
| `Alt+Shift+P` | 截圖儲存 |
| `Alt+Shift+A` | 擷取整頁文字 |

## 部署

| 服務 | 平台 | 說明 |
|------|------|------|
| API Server | [Railway](https://railway.app) | Build: `pnpm install && pnpm --filter @workspace/api-server run build`<br>Start: `node artifacts/api-server/dist/index.js` |
| Web Dashboard | [Vercel](https://vercel.com) | Root: `artifacts/web-dashboard`<br>Env: `VITE_API_BASE_URL=<Railway URL>` |
| Database | [Neon](https://neon.tech) | Serverless PostgreSQL + pgvector |
| Auth | [Supabase](https://supabase.com) | 設定 OAuth 回調至 Vercel 網址 |

部署後需更新 Chrome Extension 的 `VITE_API_BASE_URL` 至 Railway 網址並重新 build。

## 技術棧

- **後端**：Express 5、Drizzle ORM、pino、jose
- **前端**：React 18、Vite、React Router
- **Extension**：Chrome MV3、Vite
- **AI**：Groq（文字推理）+ Google Gemini（視覺 / 嵌入）
- **資料庫**：PostgreSQL + pgvector（3072 維向量搜尋）
- **驗證**：Supabase Auth（JWT HS256）
