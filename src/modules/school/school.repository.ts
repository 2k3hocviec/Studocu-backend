import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const schoolRepository = {
  list: (page: number, limit: number, search?: string) => {
    const where: Prisma.SchoolWhereInput | undefined = search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined;
    return Promise.all([
      prisma.school.findMany({ where, ...pagination(page, limit), orderBy: { name: "asc" }, include: { _count: { select: { subjects: true, documents: true } } } }),
      prisma.school.count({ where }),
    ]);
  },
  create: (data: Prisma.SchoolCreateInput) => prisma.school.create({ data }),
  findById: (id: number) => prisma.school.findUnique({ where: { id } }),
  update: (id: number, data: Prisma.SchoolUpdateInput) => prisma.school.update({ where: { id }, data }),
  remove: (id: number) => prisma.school.delete({ where: { id } }),
};
