import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const subjectRepository = {
  list: (page: number, limit: number, schoolId?: number, search?: string) => {
    const where: Prisma.SubjectWhereInput = {};
    if (schoolId) where.schoolId = schoolId;
    if (search) where.name = { contains: search, mode: "insensitive" };
    return Promise.all([
      prisma.subject.findMany({ where, ...pagination(page, limit), orderBy: { name: "asc" }, include: { school: true, _count: { select: { documents: true } } } }),
      prisma.subject.count({ where }),
    ]);
  },
  create: (data: Prisma.SubjectUncheckedCreateInput) => prisma.subject.create({ data }),
  findById: (id: number) => prisma.subject.findUnique({ where: { id } }),
  update: (id: number, data: Prisma.SubjectUncheckedUpdateInput) => prisma.subject.update({ where: { id }, data }),
  remove: (id: number) => prisma.subject.delete({ where: { id } }),
};
