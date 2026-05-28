import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./user.controller";
import { listUsersSchema, updateProfileSchema, updateStatusSchema, userIdSchema } from "./user.dto";

const router = Router();
router.get("/me", authenticate, controller.getMe);
router.patch("/me", authenticate, validate(updateProfileSchema), controller.updateMe);
router.get("/", authenticate, allowRoles(UserRole.ADMIN), validate(listUsersSchema, "query"), controller.list);
router.patch("/:id/status", authenticate, allowRoles(UserRole.ADMIN), validate(userIdSchema, "params"), validate(updateStatusSchema), controller.updateStatus);
export default router;
