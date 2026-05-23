import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createPaymentSchema = z.object({
  planId: z.coerce.number().int().positive(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.MOCK),
});
export const paymentIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const paymentHistorySchema = paginationSchema;
