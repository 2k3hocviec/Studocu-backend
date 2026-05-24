import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createPaymentSchema = z.object({
  planId: z.coerce.number().int().positive(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.MOCK),
});
export const paymentIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const paymentHistorySchema = paginationSchema;

export const vnpayReturnQuerySchema = z.object({
  vnp_ResponseCode: z.string().min(1),
  vnp_SecureHash: z.string().min(1),
  vnp_TxnRef: z.string().min(1),
  vnp_Amount: z.string().regex(/^\d+$/),
  vnp_TransactionStatus: z.string().optional(),
}).passthrough();
