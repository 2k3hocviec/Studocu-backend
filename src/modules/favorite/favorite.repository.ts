import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const favoriteRepository = {
  /** Tìm bản ghi yêu thích của user với tài liệu. */
  find: (userId: number, documentId: number) =>
    prisma.favorite.findUnique({ where: { userId_documentId: { userId, documentId } } }),
  /** Tạo bản ghi yêu thích. */
  create: (userId: number, documentId: number) => prisma.favorite.create({ data: { userId, documentId } }),
  /** Xóa bản ghi yêu thích. */
  remove: (id: number) => prisma.favorite.delete({ where: { id } }),
  /** Lấy danh sách yêu thích kèm thông tin tài liệu. */
  list: (userId: number, page: number, limit: number) =>
    Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        ...pagination(page, limit),
        orderBy: { createdAt: "desc" },
        include: { document: { include: { school: true, subject: true } } },
      }),
      prisma.favorite.count({ where: { userId } }),
    ]),
};
