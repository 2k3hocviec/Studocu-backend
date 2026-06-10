import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const listSubjectsSchema = paginationSchema.extend({ schoolId: z.coerce.number().int().positive().optional(), search: z.string().optional() });
export const subjectIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const createSubjectSchema = z.object({
  schoolId: z.coerce.number().int().positive(),
  name: z.string().min(2).max(150),
  slug: z.string().min(2).max(150).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).nullable().optional(),
});
export const updateSubjectSchema = createSubjectSchema.partial();
