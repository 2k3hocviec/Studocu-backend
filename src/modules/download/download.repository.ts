import { CreditTransactionType, DocumentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const downloadRepository = {
  findDocument: (documentId: number) =>
    prisma.document.findFirst({ where: { id: documentId, status: DocumentStatus.APPROVED }, include: { documentFile: true } }),
  findUser: (userId: number) => prisma.user.findUnique({ where: { id: userId } }),
  findActiveSubscription: (userId: number) =>
    prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      include: { plan: true },
      orderBy: { endDate: "desc" },
    }),
  countSubscriptionDownloads: (userId: number, startDate: Date, endDate: Date) =>
    prisma.download.count({ where: { userId, downloadedAt: { gte: startDate, lte: endDate } } }),
  record: (userId: number, documentId: number, creditUsed: number) =>
    prisma.$transaction(async (tx) => {
      if (creditUsed > 0) {
        await tx.user.update({ where: { id: userId }, data: { creditBalance: { decrement: creditUsed } } });
        await tx.creditTransaction.create({
          data: { userId, documentId, type: CreditTransactionType.USE_DOWNLOAD, amount: -creditUsed },
        });
      }
      const download = await tx.download.create({ data: { userId, documentId, creditUsed } });
      await tx.document.update({ where: { id: documentId }, data: { downloadCount: { increment: 1 } } });
      return download;
    }),
  history: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.download.findMany({ where: { userId }, ...pagination(page, limit), orderBy: { downloadedAt: "desc" }, include: { document: { include: { school: true, subject: true } } } }),
      prisma.download.count({ where: { userId } }),
    ]),
};
