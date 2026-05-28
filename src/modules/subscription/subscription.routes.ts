import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./subscription.controller";
import { listPlansSchema } from "./subscription.dto";

const router = Router();
router.get("/plans", validate(listPlansSchema, "query"), controller.plans);
router.get("/me", authenticate, controller.me);
export default router;
