import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import router from "./routes/index.js";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));

app.use("/api", router);

app.use(errorHandler);

export default app;