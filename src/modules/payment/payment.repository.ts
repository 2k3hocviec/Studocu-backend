import { PaymentMethod, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

const paymentInclude = {
  plan: true,
  user: { select: { id: true, fullName: true, email: true } },
};

export const paymentRepository = {
  /** Tìm gói subscription đang active. */
  findPlan: (id: number) => prisma.subscriptionPlan.findFirst({ where: { id, isActive: true } }),
  /** Tạo bản ghi thanh toán mới. */
  create: (userId: number, planId: number, amount: number, method: PaymentMethod) =>
    prisma.payment.create({ data: { userId, planId, amount, method }, include: { plan: true } }),
  /** Tìm thanh toán thuộc về user. */
  findOwned: (id: number, userId: number) => prisma.payment.findFirst({ where: { id, userId }, include: paymentInclude }),
  /** Tìm thanh toán theo id. */
  findById: (id: number) => prisma.payment.findUnique({ where: { id }, include: paymentInclude }),
  /** Đánh dấu thanh toán thất bại. */
  fail: (id: number) => prisma.payment.update({ where: { id }, data: { status: PaymentStatus.FAILED } }),
  /** Xác nhận thanh toán và tạo/gia hạn subscription trong transaction. */
  confirmAndSubscribe: (id: number, userId: number, planId: number, durationDays: number) => {
    const paidAt = new Date();
    return prisma.$transaction(async (tx) => {
      const paidPayment = await tx.payment.updateMany({
        where: { id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PAID, paidAt },
      });
      if (paidPayment.count === 0) {
        const payment = await tx.payment.findUniqueOrThrow({ where: { id }, include: paymentInclude });
        const subscription = await tx.subscription.findFirst({
          where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: paidAt } },
          orderBy: { endDate: "desc" },
          include: { plan: true },
        });
        return { payment, subscription, newlyPaid: false };
      }

      const activeSubscription = await tx.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: paidAt } },
        orderBy: { endDate: "desc" },
      });
      const startDate = activeSubscription?.endDate ?? paidAt;
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const payment = await tx.payment.findUniqueOrThrow({ where: { id }, include: paymentInclude });
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
      return { payment, subscription, newlyPaid: true };
    });
  },
  /** Lấy lịch sử thanh toán của user. */
  history: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.payment.findMany({ where: { userId }, ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { plan: true } }),
      prisma.payment.count({ where: { userId } }),
    ]),
};
