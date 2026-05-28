import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

export async function sendOtpEmail(email: string, otpCode: string, purpose: string): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    if (env.NODE_ENV === "production") {
      throw new AppError("Email delivery is not configured", 500);
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: `${purpose} OTP`,
    text: `Your OTP code is ${otpCode}. It expires in 10 minutes.`,
  });
}
