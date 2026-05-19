import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import router from "./routes/index.js";

const app: Express = express();

app.use(pinoHttp({ logger }));
const allowedOrigin = (process.env.ALLOWED_ORIGIN || "").replace(/\/$/, "") || "*";
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));

app.use("/api", router);

app.use(errorHandler);

export default app;