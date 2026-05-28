import { ReportStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const reportRepository = {
  create: (reporterId: number, data: { documentId: number; reason: string; description?: string | null }) =>
    prisma.report.create({ data: { reporterId, ...data }, include: { document: true } }),
  findById: (id: number) => prisma.report.findUnique({ where: { id } }),
  list: (page: number, limit: number) =>
    Promise.all([
      prisma.report.findMany({ ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { document: true, reporter: { select: { id: true, fullName: true, email: true } }, handler: { select: { id: true, fullName: true } } } }),
      prisma.report.count(),
    ]),
  updateStatus: (id: number, status: ReportStatus, handledBy: number) =>
    prisma.report.update({ where: { id }, data: { status, handledBy, handledAt: new Date() } }),
};
