import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const schoolRepository = {
  /** Lấy danh sách trường học chưa xóa mềm. */
  list: (page: number, limit: number, search?: string) => {
    const where: Prisma.SchoolWhereInput = { deletedAt: null };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    return Promise.all([
      prisma.school.findMany({ where, ...pagination(page, limit), orderBy: { name: "asc" }, include: { _count: { select: { subjects: true, documents: true } } } }),
      prisma.school.count({ where }),
    ]);
  },
  /** Tạo trường học mới. */
  create: (data: Prisma.SchoolCreateInput) => prisma.school.create({ data }),
  /** Tìm trường học đang active theo id. */
  findById: (id: number) => prisma.school.findFirst({ where: { id, deletedAt: null } }),
  /** Đếm môn học và tài liệu active liên quan đến trường. */
  countActiveRelations: (id: number) =>
    Promise.all([
      prisma.subject.count({ where: { schoolId: id, deletedAt: null } }),
      prisma.document.count({ where: { schoolId: id, deletedAt: null } }),
    ]),
  /** Cập nhật trường học. */
  update: (id: number, data: Prisma.SchoolUpdateInput) => prisma.school.update({ where: { id }, data }),
  /** Xóa mềm trường học. */
  remove: (id: number) => prisma.school.update({ where: { id }, data: { deletedAt: new Date() } }),
};
