import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import router from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.use("/api", router);

// Production: serve web dashboard from same origin
if (process.env.NODE_ENV === "production") {
  const dashboardDist = path.resolve(__dirname, "../../web-dashboard/dist");
  app.use(express.static(dashboardDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dashboardDist, "index.html"));
  });
}

app.use(errorHandler);

export default app;