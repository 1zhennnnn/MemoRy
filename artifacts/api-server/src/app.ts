import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import router from "./routes/index.js";

// 👇 新增這兩行來處理路徑
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// 1. 你的 API 路由（一定要放在靜態網頁前面！）
app.use("/api", router);

// ==========================================
// 👇 新增這裡：把前端的檔案交給 Express 處理 👇
// ==========================================

// 2. 告訴 Express 前端靜態檔案在哪裡（這裡假設你的前端打包資料夾叫做 "dist"）
// 如果你的資料夾叫 "public" 或其他名字，請把 "dist" 改掉，路徑也要對齊你的專案結構。
app.use(express.static(path.join(__dirname, "dist")));

// 3. 捕捉所有未匹配的路徑，全部導向前端首頁
// 這樣你的 React/Vue Router (例如 /about, /login) 重新整理時才不會報錯 404
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ==========================================

app.use(errorHandler);

export default app;