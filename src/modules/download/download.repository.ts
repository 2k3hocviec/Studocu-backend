import { DocumentStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const downloadRepository = {
  /** Tìm tài liệu đã duyệt để tải. */
  findDocument: (documentId: number) =>
    prisma.document.findFirst({
      where: { id: documentId, status: DocumentStatus.APPROVED },
      include: { documentFile: true },
    }),
  /** Tìm gói subscription còn hiệu lực của user. */
  activeSubscription: (userId: number) =>
    prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      select: { id: true },
    }),
  /** Ghi nhận hoặc cập nhật lượt tải của user cho tài liệu. */
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
  /** Lấy lịch sử tải tài liệu có phân trang. */
  history: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.download.findMany({
        where: { userId },
        ...pagination(page, limit),
        orderBy: { downloadedAt: "desc" },
        include: { document: { include: { school: true, subject: true } } },
      }),
      prisma.download.count({ where: { userId } }),
    ]),
};
