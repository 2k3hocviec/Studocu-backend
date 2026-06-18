import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((input) => input.password === input.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
export const verifyEmailSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  otpCode: z.string().regex(/^\d{6}$/),
});
export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1).optional() }).default({});
export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});
export const resetPasswordSchema = verifyEmailSchema.extend({ password: z.string().min(8).max(100) });
export const logoutSchema = refreshTokenSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
