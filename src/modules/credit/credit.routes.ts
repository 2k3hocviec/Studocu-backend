import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./credit.controller";
import { transactionHistorySchema } from "./credit.dto";

const router = Router();
router.get("/balance", authenticate, controller.balance);
router.get("/transactions", authenticate, validate(transactionHistorySchema, "query"), controller.transactions);
export default router;
