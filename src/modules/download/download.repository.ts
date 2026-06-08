import { DocumentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const downloadRepository = {
  findDocument: (documentId: number) =>
    prisma.document.findFirst({ where: { id: documentId, status: DocumentStatus.APPROVED }, include: { documentFile: true } }),
  activeSubscription: (userId: number) =>
    prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      select: { id: true },
    }),
  record: (userId: number, documentId: number) =>
    prisma.$transaction(async (tx) => {
      const download = await tx.download.upsert({
        where: { userId_documentId: { userId, documentId } },
        update: { downloadedAt: new Date() },
        create: { userId, documentId },
      });
      await tx.document.update({ where: { id: documentId }, data: { downloadCount: { increment: 1 } } });
      return download;
    }),
  history: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.download.findMany({ where: { userId }, ...pagination(page, limit), orderBy: { downloadedAt: "desc" }, include: { document: { include: { school: true, subject: true } } } }),
      prisma.download.count({ where: { userId } }),
    ]),
};
