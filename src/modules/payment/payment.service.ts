import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { paymentRepository } from "./payment.repository";
import { signVnpay, verifyVnpay } from "../../utils/vnpay";

export const paymentService = {
  async create(userId: number, planId: number, method: PaymentMethod) {
    const plan = await paymentRepository.findPlan(planId);
    if (!plan) throw new AppError("Subscription plan not found", 404);
    const payment = await paymentRepository.create(userId, plan.id, plan.price, method);
    if (method !== PaymentMethod.VNPAY) return payment;

    if (!env.VNPAY_TMN_CODE || !env.VNPAY_HASH_SECRET || !env.VNPAY_RETURN_URL) {
      throw new AppError("VNPAY is not configured", 500);
    }

    const vnpParams = {
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: String(payment.id),
      vnp_Amount: String(Math.round(payment.amount * 100)),
      vnp_OrderInfo: `Payment ${payment.id} for plan ${payment.planId}`,
      vnp_ResponseCode: "00",
    };
    const secureHash = signVnpay(vnpParams, env.VNPAY_HASH_SECRET);
    const checkoutUrl =
      `${env.VNPAY_RETURN_URL}?` +
      Object.entries({ ...vnpParams, vnp_SecureHash: secureHash })
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");

    return { ...payment, checkoutUrl };
  },
  async mockConfirm(userId: number, paymentId: number) {
    if (env.NODE_ENV === "production") throw new AppError("Mock payments are disabled in production", 403);
    const payment = await paymentRepository.findOwned(paymentId, userId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.status !== PaymentStatus.PENDING) throw new AppError("Payment has already been processed", 409);
    return paymentRepository.confirmAndSubscribe(payment.id, userId, payment.planId, payment.plan.durationDays);
  },
  async history(userId: number, page: number, limit: number) {
    const [items, total] = await paymentRepository.history(userId, page, limit);
    return paginated(items, total, page, limit);
  },

  async vnpayReturn(userId: number, paymentId: number, query: { vnp_ResponseCode: string; vnp_SecureHash: string } & Record<string, string>) {
    if (!env.VNPAY_HASH_SECRET) throw new AppError("VNPAY is not configured", 500);

    const payment = await paymentRepository.findOwned(paymentId, userId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.method !== PaymentMethod.VNPAY) throw new AppError("Invalid payment method", 400);
    if (payment.status !== PaymentStatus.PENDING) throw new AppError("Payment has already been processed", 409);

    const ok = verifyVnpay(query, query.vnp_SecureHash, env.VNPAY_HASH_SECRET);
    if (!ok) throw new AppError("Invalid VNPAY signature", 400);
    if (query.vnp_ResponseCode !== "00") throw new AppError("VNPAY payment failed", 400);

    return paymentRepository.confirmAndSubscribe(payment.id, userId, payment.planId, payment.plan.durationDays);
  },
};
