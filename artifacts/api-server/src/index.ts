import app from "./app.js";
import { logger } from "./lib/logger.js";

const port = parseInt(process.env["PORT"] ?? "5000", 10);

app.listen(port, () => {
  logger.info({ port }, "MemoRy API server started");
});
