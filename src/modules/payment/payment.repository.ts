import { PaymentMethod, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const paymentRepository = {
  findPlan: (id: number) => prisma.subscriptionPlan.findFirst({ where: { id, isActive: true } }),
  create: (userId: number, planId: number, amount: number, method: PaymentMethod) =>
    prisma.payment.create({ data: { userId, planId, amount, method }, include: { plan: true } }),
  findOwned: (id: number, userId: number) => prisma.payment.findFirst({ where: { id, userId }, include: { plan: true } }),
  findById: (id: number) => prisma.payment.findUnique({ where: { id }, include: { plan: true } }),
  fail: (id: number) => prisma.payment.update({ where: { id }, data: { status: PaymentStatus.FAILED } }),
  confirmAndSubscribe: (id: number, userId: number, planId: number, durationDays: number) => {
    const paidAt = new Date();
    return prisma.$transaction(async (tx) => {
      const paidPayment = await tx.payment.updateMany({
        where: { id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PAID, paidAt },
      });
      if (paidPayment.count === 0) {
        const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
        const subscription = await tx.subscription.findFirst({
          where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: paidAt } },
          orderBy: { endDate: "desc" },
          include: { plan: true },
        });
        return { payment, subscription };
      }

      const activeSubscription = await tx.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: paidAt } },
        orderBy: { endDate: "desc" },
      });
      const startDate = activeSubscription?.endDate ?? paidAt;
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      const subscription = activeSubscription
        ? await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: { planId, startDate, endDate, status: SubscriptionStatus.ACTIVE },
            include: { plan: true },
          })
        : await tx.subscription.create({
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
