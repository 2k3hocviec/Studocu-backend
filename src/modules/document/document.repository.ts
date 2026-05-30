import { CreditTransactionType, DocumentStatus, DocumentType, Prisma, ReactionType } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export interface NewDocumentData {
  uploaderId: number;
  schoolId: number;
  subjectId: number;
  title: string;
  description?: string | null;
  documentType: DocumentType;
  file: {
    fileUrl: string;
    previewUrl?: string;
    originalFilename: string;
    fileType: "PDF" | "DOCX" | "PPTX";
    fileSize: number;
    totalPages?: number;
    storageProvider: "CLOUDINARY" | "S3";
  };
  previews?: Array<{ pageNumber: number; imageUrl: string; isBlurred: boolean }>;
}

const detailInclude = {
  uploader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  school: true,
  subject: true,
  documentFile: true,
  previews: { orderBy: { pageNumber: "asc" as const } },
};

export const documentRepository = {
  list: (page: number, limit: number, filters: { schoolId?: number, subjectId?: number, type?: DocumentType, search?: string, status?: DocumentStatus, isAdmin?: boolean }) => {
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
    };
    if (!filters.isAdmin) {
      where.status = DocumentStatus.APPROVED;
      where.school = { deletedAt: null };
      where.subject = { deletedAt: null };
    } else if (filters.status) {
      where.status = filters.status;
    }
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.type) where.documentType = filters.type;
    if (filters.search) where.OR = [{ title: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }];
    return Promise.all([
      prisma.document.findMany({
        where,
        ...pagination(page, limit),
        orderBy: { createdAt: "desc" },
        include: {
          uploader: { select: { id: true, fullName: true } },
          school: true,
          subject: true,
          documentFile: { select: { totalPages: true } },
          previews: {
            orderBy: { pageNumber: "asc" },
            take: 1,
            select: { imageUrl: true },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);
  },
  findDetail: (id: number) => prisma.document.findFirst({ where: { id, deletedAt: null }, include: detailInclude }),
  reactionCounts: (documentId: number) =>
    prisma.documentReaction.groupBy({
      by: ["type"],
      where: { documentId },
      _count: { type: true },
    }),
  findReaction: (documentId: number, userId: number) =>
    prisma.documentReaction.findUnique({ where: { userId_documentId: { userId, documentId } } }),
  setReaction: (documentId: number, userId: number, type: ReactionType) =>
    prisma.documentReaction.upsert({
      where: { userId_documentId: { userId, documentId } },
      update: { type },
      create: { userId, documentId, type },
    }),
  removeReaction: (documentId: number, userId: number) =>
    prisma.documentReaction.deleteMany({ where: { userId, documentId } }),
  incrementView: (id: number) => prisma.document.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
  recordUserView: (documentId: number, userId: number) =>
    prisma.documentView.upsert({
      where: { userId_documentId: { userId, documentId } },
      update: { viewedAt: new Date() },
      create: { userId, documentId },
    }),
  create: (data: NewDocumentData) =>
    prisma.document.create({
      data: {
        uploaderId: data.uploaderId, schoolId: data.schoolId, subjectId: data.subjectId,
        title: data.title, description: data.description, documentType: data.documentType,
        documentFile: { create: data.file },
        previews: data.previews ? { create: data.previews } : undefined,
      },
      include: detailInclude,
    }),
  update: (id: number, data: Prisma.DocumentUpdateInput) => prisma.document.update({ where: { id }, data, include: detailInclude }),
  remove: (id: number) => prisma.document.update({ where: { id }, data: { deletedAt: new Date() } }),
  approveWithReward: (id: number, moderatorId: number, uploaderId: number, reward: boolean) =>
    prisma.$transaction(async (tx) => {
      const document = await tx.document.update({
        where: { id },
        data: { status: DocumentStatus.APPROVED, approvedBy: moderatorId, approvedAt: new Date(), rejectReason: null },
        include: detailInclude,
      });
      if (reward && !document.creditEarned) {
        const creditAmount = 2;
        await tx.user.update({ where: { id: uploaderId }, data: { creditBalance: { increment: creditAmount } } });
        await tx.creditTransaction.create({ data: { userId: uploaderId, documentId: id, type: CreditTransactionType.EARN_UPLOAD, amount: creditAmount } });
        await tx.document.update({
          where: { id },
          data: { creditEarned: true },
        });
      }
      return document;
    }),
  reject: (id: number, moderatorId: number, reason: string) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.REJECTED, approvedBy: moderatorId, approvedAt: new Date(), rejectReason: reason },
      include: detailInclude,
    }),
  hide: (id: number, moderatorId: number) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.HIDDEN, approvedBy: moderatorId, approvedAt: new Date() },
      include: detailInclude,
    }),
  unhide: (id: number, moderatorId: number) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.APPROVED, approvedBy: moderatorId, approvedAt: new Date() },
      include: detailInclude,
    }),
  recordDownload: (documentId: number, userId: number) =>
    prisma.download.upsert({
      where: { userId_documentId: { userId, documentId } },
      update: { downloadedAt: new Date() },
      create: {
        userId,
        documentId,
      },
    }),
  incrementDownload: (id: number) => prisma.document.update({ where: { id }, data: { downloadCount: { increment: 1 } } }),
};
