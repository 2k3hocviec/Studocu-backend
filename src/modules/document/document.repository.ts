import { CreditTransactionType, DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

export interface NewDocumentData {
  uploaderId: number;
  schoolId: number;
  subjectId: number;
  title: string;
  description?: string | null;
  documentType: DocumentType;
  isPremium: boolean;
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
  uploader: { select: { id: true, fullName: true, avatarUrl: true } },
  school: true,
  subject: true,
  documentFile: true,
  previews: { orderBy: { pageNumber: "asc" as const } },
};

export const documentRepository = {
  listApproved: (page: number, limit: number, schoolId?: number, subjectId?: number, type?: DocumentType, search?: string) => {
    const where: Prisma.DocumentWhereInput = { status: DocumentStatus.APPROVED };
    if (schoolId) where.schoolId = schoolId;
    if (subjectId) where.subjectId = subjectId;
    if (type) where.documentType = type;
    if (search) where.OR = [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }];
    return Promise.all([
      prisma.document.findMany({ where, ...pagination(page, limit), orderBy: { createdAt: "desc" }, include: { uploader: { select: { id: true, fullName: true } }, school: true, subject: true } }),
      prisma.document.count({ where }),
    ]);
  },
  findDetail: (id: number) => prisma.document.findUnique({ where: { id }, include: detailInclude }),
  findActiveSubscription: (userId: number) =>
    prisma.subscription.findFirst({ where: { userId, status: "ACTIVE", endDate: { gt: new Date() } } }),
  incrementView: (id: number) => prisma.document.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
  create: (data: NewDocumentData) =>
    prisma.document.create({
      data: {
        uploaderId: data.uploaderId, schoolId: data.schoolId, subjectId: data.subjectId,
        title: data.title, description: data.description, documentType: data.documentType, isPremium: data.isPremium,
        documentFile: { create: data.file },
        previews: data.previews ? { create: data.previews } : undefined,
      },
      include: detailInclude,
    }),
  update: (id: number, data: Prisma.DocumentUpdateInput) => prisma.document.update({ where: { id }, data, include: detailInclude }),
  remove: (id: number) => prisma.document.delete({ where: { id } }),
  approveWithReward: (id: number, moderatorId: number, uploaderId: number, reward: boolean) =>
    prisma.$transaction(async (tx) => {
      const document = await tx.document.update({
        where: { id },
        data: { status: DocumentStatus.APPROVED, approvedBy: moderatorId, approvedAt: new Date(), rejectReason: null },
        include: detailInclude,
      });
      if (reward) {
        await tx.user.update({ where: { id: uploaderId }, data: { creditBalance: { increment: 2 } } });
        await tx.creditTransaction.create({ data: { userId: uploaderId, documentId: id, type: CreditTransactionType.EARN_UPLOAD, amount: 2 } });
      }
      return document;
    }),
  reject: (id: number, moderatorId: number, reason: string) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.REJECTED, approvedBy: moderatorId, approvedAt: new Date(), rejectReason: reason },
      include: detailInclude,
    }),
};
