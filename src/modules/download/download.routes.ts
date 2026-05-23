import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./download.controller";
import { downloadHistorySchema, downloadParamsSchema } from "./download.dto";

const router = Router();
router.get("/history", authenticate, validate(downloadHistorySchema, "query"), controller.history);
router.post("/:documentId", authenticate, validate(downloadParamsSchema, "params"), controller.download);
export default router;
