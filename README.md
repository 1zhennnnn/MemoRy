# MemoRy

AI 碎片化知識管理系統 — 隨手擷取網頁內容，自動摘要、標籤、向量搜尋。

## 功能

- **Chrome Extension**：選取文字、整頁擷取、截圖 OCR，快捷鍵一鍵儲存
- **Web Dashboard**：時間軸瀏覽、語意搜尋、AI 日報
- **AI 自動處理**：摘要、標籤、向量嵌入（Ollama 本地 / Google Gemini）
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

## 快速開始

### 環境需求

- Node.js 20+
- pnpm 9+
- PostgreSQL（含 pgvector）或 [Neon](https://neon.tech) 免費方案

### 安裝

```bash
git clone https://github.com/<your-username>/memory.git
cd memory
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
| `GEMMA_API_KEY` | Google AI API Key | [Google AI Studio](https://aistudio.google.com) |

### 啟用 pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

```bash
pnpm --filter @workspace/db run push
```

### 啟動開發伺服器

```bash
# API Server（port 5000）
pnpm --filter @workspace/api-server run dev

# Web Dashboard（port 3000）
pnpm --filter @workspace/web-dashboard run dev
```

### 載入 Chrome Extension

```bash
pnpm --filter @workspace/chrome-ext run build
```

Chrome → `chrome://extensions` → 開啟開發者模式 → 載入未封裝項目 → 選 `artifacts/chrome-ext/dist/`

## 部署

| 服務 | 平台 | 說明 |
|------|------|------|
| API Server | [Render](https://render.com) | Build: `pnpm install && pnpm --filter @workspace/api-server run build`<br>Start: `node artifacts/api-server/dist/index.js` |
| Web Dashboard | [Vercel](https://vercel.com) | Root: `artifacts/web-dashboard` |
| Database | [Neon](https://neon.tech) | Serverless PostgreSQL + pgvector |
| Auth | [Supabase](https://supabase.com) | 設定 OAuth 回調至 Vercel 網址 |

## 技術棧

- **後端**：Express 5、Drizzle ORM、pino、jose
- **前端**：React 18、Vite、React Router
- **Extension**：Chrome MV3、Vite
- **AI**：Ollama（本地）/ Google Gemini（雲端）
- **資料庫**：PostgreSQL + pgvector（向量搜尋）
- **驗證**：Supabase Auth（JWT HS256）
