import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import * as controller from "./dashboard.controller";

const router = Router();

router.get("/stats", authenticate, allowRoles(UserRole.ADMIN, UserRole.MODERATOR), controller.getStats);

export default router;
