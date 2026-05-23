import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const creditRepository = {
  balance: (userId: number) => prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
  transactions: (userId: number, page: number, limit: number, documentId?: number) => {
    const where = { userId, ...(documentId ? { documentId } : {}) };
    return Promise.all([
      prisma.creditTransaction.findMany({ where, ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { document: { select: { id: true, title: true } } } }),
      prisma.creditTransaction.count({ where }),
    ]);
  },
};
