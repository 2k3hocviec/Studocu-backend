import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

type MailOptions = {
  to: string;
  subject: string;
  text: string;
  failWhenUnconfigured?: boolean;
};

function isEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

async function sendMail({
  to,
  subject,
  text,
  failWhenUnconfigured = false,
}: MailOptions): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    if (failWhenUnconfigured || env.NODE_ENV === "production") {
      throw new AppError("Email delivery is not configured", 500);
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    family: 4,
    requireTLS: Number(env.SMTP_PORT) === 587,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  } as any);

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
  });
}

async function sendNotificationEmail(options: MailOptions) {
  if (!isEmailConfigured()) return;
  try {
    await sendMail(options);
  } catch (error) {
    console.error("Email notification failed:", error);
  }
}

export async function sendOtpEmail(
  email: string,
  otpCode: string,
  purpose: string,
): Promise<void> {
  await sendMail({
    to: email,
    subject: `${purpose} OTP`,
    text: `Your OTP code is ${otpCode}. It expires in 10 minutes.`,
    failWhenUnconfigured: env.NODE_ENV === "production",
  });
}

export async function sendPremiumPaymentSuccessEmail(data: {
  email: string;
  fullName?: string | null;
  planName?: string | null;
  endDate?: Date | null;
}): Promise<void> {
  const name = data.fullName?.trim() || "bạn";
  const planName = data.planName?.trim() || "Premium";
  const endDate = data.endDate
    ? new Intl.DateTimeFormat("vi-VN").format(data.endDate)
    : "chưa xác định";

  await sendNotificationEmail({
    to: data.email,
    subject: "Thanh toán Premium thành công",
    text: [
      `Xin chào ${name},`,
      "",
      `Thanh toán gói ${planName} của bạn đã thành công.`,
      `Tài khoản Premium có hiệu lực đến ngày ${endDate}.`,
      "",
      "Cảm ơn bạn đã sử dụng Kho Tài Liệu Số.",
    ].join("\n"),
  });
}

export async function sendDocumentApprovedEmail(data: {
  email: string;
  fullName?: string | null;
  documentTitle: string;
}): Promise<void> {
  const name = data.fullName?.trim() || "bạn";

  await sendNotificationEmail({
    to: data.email,
    subject: "Tài liệu của bạn đã được duyệt",
    text: [
      `Xin chào ${name},`,
      "",
      `Tài liệu "${data.documentTitle}" của bạn đã được duyệt và có thể hiển thị trên hệ thống.`,
      "",
      "Cảm ơn bạn đã đóng góp tài liệu cho Kho Tài Liệu Số.",
    ].join("\n"),
  });
}
