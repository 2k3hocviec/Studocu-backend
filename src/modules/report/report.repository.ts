import { ReportStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export const reportRepository = {
  create: (reporterId: number, data: { documentId: number; reason: string; description?: string | null }) =>
    prisma.report.create({ data: { reporterId, ...data }, include: { document: true } }),
  findById: (id: number) => prisma.report.findUnique({ where: { id } }),
  findDocumentForReport: (id: number) =>
    prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, uploaderId: true },
    }),
  findDetail: (id: number) =>
    prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, fullName: true, email: true } },
        handler: { select: { id: true, fullName: true } },
        document: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            documentType: true,
            viewCount: true,
            downloadCount: true,
            rejectReason: true,
            createdAt: true,
            uploader: { select: { id: true, fullName: true } },
            school: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            documentFile: {
              select: {
                fileType: true,
                totalPages: true,
              },
            },
            previews: {
              orderBy: { pageNumber: "asc" },
              select: {
                id: true,
                pageNumber: true,
                imageUrl: true,
                isBlurred: true,
              },
            },
          },
        },
      },
    }),
  list: (page: number, limit: number) =>
    Promise.all([
      prisma.report.findMany({ ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { document: true, reporter: { select: { id: true, fullName: true, email: true } }, handler: { select: { id: true, fullName: true } } } }),
      prisma.report.count(),
    ]),
  updateStatus: (id: number, status: ReportStatus, handledBy: number) =>
    prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: { status, handledBy, handledAt: new Date() },
      });
      if (status === ReportStatus.RESOLVED) {
        await tx.document.update({
          where: { id: report.documentId },
          data: { status: "HIDDEN", approvedBy: handledBy, approvedAt: new Date() },
        });
      }
      return report;
    }),
};
