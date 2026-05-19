import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import router from "./routes/index.js";

const app: Express = express();

app.use(pinoHttp({ logger }));
const allowedOrigin = (process.env.ALLOWED_ORIGIN || "").replace(/\/$/, "");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigin) return callback(null, true);
    if (origin === allowedOrigin) return callback(null, true);
    if (origin.endsWith(".vercel.app")) return callback(null, true);
    if (origin.startsWith("http://localhost")) return callback(null, true);
    if (origin.startsWith("chrome-extension://")) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));

app.use("/api", router);

app.use(errorHandler);

export default app;