import { PaymentMethod, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const paymentRepository = {
  findPlan: (id: number) => prisma.subscriptionPlan.findFirst({ where: { id, isActive: true } }),
  create: (userId: number, planId: number, amount: number, method: PaymentMethod) =>
    prisma.payment.create({ data: { userId, planId, amount, method }, include: { plan: true } }),
  findOwned: (id: number, userId: number) => prisma.payment.findFirst({ where: { id, userId }, include: { plan: true } }),
  findById: (id: number) => prisma.payment.findUnique({ where: { id }, include: { plan: true } }),
  confirmAndSubscribe: (id: number, userId: number, planId: number, durationDays: number) => {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({ where: { id }, data: { status: PaymentStatus.PAID, paidAt: startDate } });
      const subscription = await tx.subscription.create({
        data: { userId, planId, startDate, endDate, status: SubscriptionStatus.ACTIVE },
        include: { plan: true },
      });
      return { payment, subscription };
    });
  },
  history: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.payment.findMany({ where: { userId }, ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { plan: true } }),
      prisma.payment.count({ where: { userId } }),
    ]),
};
