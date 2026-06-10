import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(3000)),
  HOST: z.preprocess(emptyToUndefined, z.string().default("0.0.0.0")),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLOUDINARY_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  SOFFICE_PATH: z.preprocess(emptyToUndefined, z.string().optional()),
  POPPLER_PATH: z.preprocess(emptyToUndefined, z.string().optional()),
  PDFTOPPM_PATH: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(587)),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_FROM: z.preprocess(emptyToUndefined, z.string().email().default("no-reply@example.com")),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  VNPAY_TMN_CODE: z.preprocess(emptyToUndefined, z.string().optional()),
  VNPAY_HASH_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  VNPAY_PAYMENT_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),
  ),
  VNPAY_RETURN_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  FRONTEND_URL: z.preprocess(emptyToUndefined, z.string().url().default("http://localhost:5000")),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment configuration is invalid");
}

export const env = parsed.data;
