import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const schoolRepository = {
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
  create: (data: Prisma.SchoolCreateInput) => prisma.school.create({ data }),
  findById: (id: number) => prisma.school.findFirst({ where: { id, deletedAt: null } }),
  countActiveRelations: (id: number) =>
    Promise.all([
      prisma.subject.count({ where: { schoolId: id, deletedAt: null } }),
      prisma.document.count({ where: { schoolId: id, deletedAt: null } }),
    ]),
  update: (id: number, data: Prisma.SchoolUpdateInput) => prisma.school.update({ where: { id }, data }),
  remove: (id: number) => prisma.school.update({ where: { id }, data: { deletedAt: new Date() } }),
};
