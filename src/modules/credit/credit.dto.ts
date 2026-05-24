import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const transactionHistorySchema = paginationSchema.extend({
  documentId: z.coerce.number().int().positive().optional(),
});

export const adminAdjustSchema = z.object({
  userId: z.coerce.number().int().positive(),
  amount: z.coerce.number(),
});
