import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export const listUsersSchema = paginationSchema.extend({ search: z.string().optional() });
export const recentDocumentsSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export const userIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const updateStatusSchema = z.object({ status: z.nativeEnum(UserStatus) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp.",
  path: ["confirmPassword"],
});
