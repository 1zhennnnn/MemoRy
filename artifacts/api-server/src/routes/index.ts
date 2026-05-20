import { Router, type IRouter } from "express";
import healthRouter  from "./health.js";
import notesRouter   from "./notes.js";
import searchRouter  from "./search.js";
import reportsRouter from "./reports.js";
import tagsRouter    from "./tags.js";
import exportRouter  from "./export.js";
import agentRouter   from "./agent.js";
import graphRouter   from "./graph.js";

const router: IRouter = Router();

router.use(healthRouter);    // GET /healthz
router.use(notesRouter);     // /notes  /notes/text  /notes/image  /notes/:id
router.use(searchRouter);    // POST /search  GET /search/keyword
router.use(reportsRouter);   // /reports  /reports/generate  /reports/:date
router.use(tagsRouter);      // GET /tags
router.use(exportRouter);    // GET /export
router.use(agentRouter);     // POST /agent/chat  /agent/conversations
router.use(graphRouter);     // GET /graph

export default router;
