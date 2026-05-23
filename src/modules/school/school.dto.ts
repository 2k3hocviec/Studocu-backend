import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const listSchoolsSchema = paginationSchema.extend({ search: z.string().optional() });
export const schoolIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const createSchoolSchema = z.object({
  name: z.string().min(2).max(150),
  slug: z.string().min(2).max(150).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).nullable().optional(),
});
export const updateSchoolSchema = createSchoolSchema.partial();
