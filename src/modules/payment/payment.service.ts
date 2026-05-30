import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { sendPremiumPaymentSuccessEmail } from "../../utils/email";
import { paginated } from "../../utils/pagination";
import { paymentRepository } from "./payment.repository";
import { buildVnpayUrl, verifyVnpay } from "../../utils/vnpay";

function formatVnpayDate(date: Date) {
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return vietnamTime.toISOString().replace(/\D/g, "").slice(0, 14);
}

function normalizeIp(ip?: string) {
  if (!ip || ip === "::1") return "127.0.0.1";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

async function notifyPremiumSuccess(result: Awaited<ReturnType<typeof paymentRepository.confirmAndSubscribe>>) {
  if (!result.newlyPaid || !result.subscription) return;

  await sendPremiumPaymentSuccessEmail({
    email: result.payment.user.email,
    fullName: result.payment.user.fullName,
    planName: result.subscription.plan.name,
    endDate: result.subscription.endDate,
  });
}

export const paymentService = {
  async create(userId: number, planId: number, method: PaymentMethod, clientIp?: string) {
    const plan = await paymentRepository.findPlan(planId);
    if (!plan) throw new AppError("Subscription plan not found", 404);
    const tmnCode = env.VNPAY_TMN_CODE;
    const hashSecret = env.VNPAY_HASH_SECRET;
    const returnUrl = env.VNPAY_RETURN_URL;
    if (method === PaymentMethod.VNPAY && (!tmnCode || !hashSecret || !returnUrl)) {
      throw new AppError("VNPAY is not configured", 500);
    }
    const payment = await paymentRepository.create(userId, plan.id, plan.price, method);
    if (method !== PaymentMethod.VNPAY) return payment;
    if (!tmnCode || !hashSecret || !returnUrl) throw new AppError("VNPAY is not configured", 500);

    const vnpParams = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_TxnRef: String(payment.id),
      vnp_Amount: String(Math.round(payment.amount * 100)),
      vnp_CurrCode: "VND",
      vnp_OrderInfo: `Payment ${payment.id} for plan ${payment.planId}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: normalizeIp(clientIp),
      vnp_CreateDate: formatVnpayDate(new Date()),
    };
    const paymentUrl = buildVnpayUrl(env.VNPAY_PAYMENT_URL, vnpParams, hashSecret);

    return { ...payment, paymentUrl };
  },
  async mockConfirm(userId: number, paymentId: number) {
    if (env.NODE_ENV === "production") throw new AppError("Mock payments are disabled in production", 403);
    const payment = await paymentRepository.findOwned(paymentId, userId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.status !== PaymentStatus.PENDING) throw new AppError("Payment has already been processed", 409);
    const result = await paymentRepository.confirmAndSubscribe(payment.id, userId, payment.planId, payment.plan.durationDays);
    await notifyPremiumSuccess(result);
    return result;
  },
  async history(userId: number, page: number, limit: number) {
    const [items, total] = await paymentRepository.history(userId, page, limit);
    return paginated(items, total, page, limit);
  },

  async vnpayReturn(paymentId: number, query: { vnp_ResponseCode: string; vnp_SecureHash: string } & Record<string, string>) {
    if (!env.VNPAY_HASH_SECRET) throw new AppError("VNPAY is not configured", 500);

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.method !== PaymentMethod.VNPAY) throw new AppError("Invalid payment method", 400);

    const ok = verifyVnpay(query, query.vnp_SecureHash, env.VNPAY_HASH_SECRET);
    if (!ok) throw new AppError("Invalid VNPAY signature", 400);
    if (String(Math.round(payment.amount * 100)) !== query.vnp_Amount) {
      throw new AppError("Invalid VNPAY amount", 400);
    }
    const success =
      query.vnp_ResponseCode === "00" &&
      (!query.vnp_TransactionStatus || query.vnp_TransactionStatus === "00");
    if (payment.status === PaymentStatus.PAID) return { success: true, paymentId: payment.id };
    if (payment.status === PaymentStatus.FAILED) return { success: false, paymentId: payment.id };
    if (payment.status !== PaymentStatus.PENDING) throw new AppError("Payment has already been processed", 409);
    if (!success) {
      await paymentRepository.fail(payment.id);
      return { success: false, paymentId: payment.id };
    }

    const result = await paymentRepository.confirmAndSubscribe(payment.id, payment.userId, payment.planId, payment.plan.durationDays);
    await notifyPremiumSuccess(result);
    return { success: true, paymentId: payment.id };
  },

  async vnpayIpn(paymentId: number, query: { vnp_ResponseCode: string; vnp_SecureHash: string } & Record<string, string>) {
    if (!env.VNPAY_HASH_SECRET) throw new AppError("VNPAY is not configured", 500);

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.method !== PaymentMethod.VNPAY) throw new AppError("Invalid payment method", 400);

    const ok = verifyVnpay(query, query.vnp_SecureHash, env.VNPAY_HASH_SECRET);
    if (!ok) throw new AppError("Invalid VNPAY signature", 400);
    if (String(Math.round(payment.amount * 100)) !== query.vnp_Amount) {
      throw new AppError("Invalid VNPAY amount", 400);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return { success: payment.status === PaymentStatus.PAID, alreadyProcessed: true };
    }

    const success =
      query.vnp_ResponseCode === "00" &&
      (!query.vnp_TransactionStatus || query.vnp_TransactionStatus === "00");
    if (!success) {
      await paymentRepository.fail(payment.id);
      return { success: false, alreadyProcessed: false };
    }

    const result = await paymentRepository.confirmAndSubscribe(payment.id, payment.userId, payment.planId, payment.plan.durationDays);
    await notifyPremiumSuccess(result);
    return { success: true, alreadyProcessed: false };
  },
};
