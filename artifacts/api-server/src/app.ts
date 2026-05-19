import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import router from "./routes/index.js";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// --- 👇 新增這裡：設定根目錄首頁路由 👇 ---
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "success",
    message: "MemoRy API Server 正常運行中！",
    docs: "請使用 /api 進行資料存取" 
  });
});
// ------------------------------------------

app.use("/api", router);
app.use(errorHandler);

export default app;