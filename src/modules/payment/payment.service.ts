import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { paymentRepository } from "./payment.repository";

export const paymentService = {
  async create(userId: number, planId: number, method: PaymentMethod) {
    const plan = await paymentRepository.findPlan(planId);
    if (!plan) throw new AppError("Subscription plan not found", 404);
    return paymentRepository.create(userId, plan.id, plan.price, method);
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
};
