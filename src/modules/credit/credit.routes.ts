import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./credit.controller";
import { adminAdjustSchema, transactionHistorySchema } from "./credit.dto";
import { UserRole } from "@prisma/client";

const router = Router();
router.get("/balance", authenticate, controller.balance);
router.get("/transactions", authenticate, validate(transactionHistorySchema, "query"), controller.transactions);
router.post("/admin-adjust", authenticate, allowRoles(UserRole.ADMIN), validate(adminAdjustSchema), controller.adminAdjust);
export default router;
