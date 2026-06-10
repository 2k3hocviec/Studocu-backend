import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";
import { CreditTransactionType } from "@prisma/client";

export const creditRepository = {
  /** Lấy số dư credit của user. */
  balance: (userId: number) => prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
  /** Lấy lịch sử giao dịch credit theo user và tài liệu nếu có. */
  transactions: (userId: number, page: number, limit: number, documentId?: number) => {
    const where = { userId, ...(documentId ? { documentId } : {}) };
    return Promise.all([
      prisma.creditTransaction.findMany({ where, ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { document: { select: { id: true, title: true } } } }),
      prisma.creditTransaction.count({ where }),
    ]);
  },
  /** Cập nhật số dư credit và ghi lại giao dịch điều chỉnh. */
  adminAdjust: (userId: number, amount: number) =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: { creditBalance: { increment: amount } }, select: { id: true, creditBalance: true } });
      const transaction = await tx.creditTransaction.create({
        data: { userId, type: CreditTransactionType.ADMIN_ADJUST, amount },
      });
      return { user, transaction };
    }),
};
