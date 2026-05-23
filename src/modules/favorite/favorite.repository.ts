import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const favoriteRepository = {
  find: (userId: number, documentId: number) => prisma.favorite.findUnique({ where: { userId_documentId: { userId, documentId } } }),
  create: (userId: number, documentId: number) => prisma.favorite.create({ data: { userId, documentId } }),
  remove: (id: number) => prisma.favorite.delete({ where: { id } }),
  list: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.favorite.findMany({ where: { userId }, ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { document: { include: { school: true, subject: true } } } }),
      prisma.favorite.count({ where: { userId } }),
    ]),
};
