import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export const listUsersSchema = paginationSchema.extend({ search: z.string().optional() });
export const userIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const updateStatusSchema = z.object({ status: z.nativeEnum(UserStatus) });
