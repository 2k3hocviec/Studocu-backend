import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./payment.controller";
import { createPaymentSchema, paymentHistorySchema, paymentIdSchema, vnpayReturnQuerySchema } from "./payment.dto";

const router = Router();
router.post("/", authenticate, validate(createPaymentSchema), controller.create);
router.post("/mock-confirm/:id", authenticate, validate(paymentIdSchema, "params"), controller.mockConfirm);
router.get("/history", authenticate, validate(paymentHistorySchema, "query"), controller.history);
router.get("/vnpay/return", validate(vnpayReturnQuerySchema, "query"), controller.vnpayReturn);
router.get("/vnpay/ipn", validate(vnpayReturnQuerySchema, "query"), controller.vnpayIpn);
export default router;
