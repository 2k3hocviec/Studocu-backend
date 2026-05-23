import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const subscriptionRepository = {
  listPlans: (page: number, limit: number) =>
    Promise.all([
      prisma.subscriptionPlan.findMany({ where: { isActive: true }, ...pagination(page, limit), orderBy: { price: "asc" } }),
      prisma.subscriptionPlan.count({ where: { isActive: true } }),
    ]),
  activeForUser: (userId: number) =>
    prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      orderBy: { endDate: "desc" },
      include: { plan: true },
    }),
};
