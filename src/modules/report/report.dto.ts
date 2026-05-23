import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createReportSchema = z.object({
  documentId: z.coerce.number().int().positive(),
  reason: z.string().min(3).max(200),
  description: z.string().max(1000).nullable().optional(),
});
export const reportIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const listReportsSchema = paginationSchema;
