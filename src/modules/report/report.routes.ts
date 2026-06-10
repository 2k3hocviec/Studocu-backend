import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./report.controller";
import { createReportSchema, listReportsSchema, reportIdSchema } from "./report.dto";

const router = Router();
router.post("/", authenticate, validate(createReportSchema), controller.create);
router.get("/", authenticate, allowRoles(UserRole.ADMIN), validate(listReportsSchema, "query"), controller.list);
router.get("/:id", authenticate, allowRoles(UserRole.ADMIN), validate(reportIdSchema, "params"), controller.detail);
router.patch("/:id/resolve", authenticate, allowRoles(UserRole.ADMIN), validate(reportIdSchema, "params"), controller.resolve);
router.patch("/:id/reject", authenticate, allowRoles(UserRole.ADMIN), validate(reportIdSchema, "params"), controller.reject);
export default router;
