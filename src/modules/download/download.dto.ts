import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const downloadParamsSchema = z.object({ documentId: z.coerce.number().int().positive() });
export const downloadHistorySchema = paginationSchema;
