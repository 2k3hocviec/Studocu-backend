import { CreditTransactionType, DocumentStatus, DocumentType, Prisma, ReactionType, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

const CREDIT_UNLOCK_TYPE = CreditTransactionType.USE_DOWNLOAD;

export interface NewDocumentData {
  uploaderId: number;
  schoolId?: number | null;
  subjectId?: number | null;
  requestedSchoolName?: string | null;
  requestedSubjectName?: string | null;
  title: string;
  description?: string | null;
  documentType: DocumentType;
  file: {
    fileUrl: string;
    originalFilename: string;
    fileType: "PDF" | "DOCX" | "PPTX";
    fileSize: number;
    totalPages?: number;
    storageProvider: "CLOUDINARY" | "LOCAL" | "S3";
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

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

async function uniqueSlug(
  tx: Prisma.TransactionClient,
  model: "school" | "subject",
  name: string,
) {
  const base = slugify(name);
  let suffix = 0;

  while (suffix < 1000) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = model === "school"
      ? await tx.school.findUnique({ where: { slug }, select: { id: true } })
      : await tx.subject.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    suffix += 1;
  }

  return `${base}-${Date.now()}`;
}

async function findOrCreateSchool(tx: Prisma.TransactionClient, name: string) {
  const existing = await tx.school.findFirst({
    where: { deletedAt: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const school = await tx.school.create({
    data: { name, slug: await uniqueSlug(tx, "school", name) },
    select: { id: true },
  });
  return school.id;
}

async function findOrCreateSubject(tx: Prisma.TransactionClient, schoolId: number, name: string) {
  const existing = await tx.subject.findFirst({
    where: { deletedAt: null, schoolId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const subject = await tx.subject.create({
    data: { schoolId, name, slug: await uniqueSlug(tx, "subject", `${name}-${schoolId}`) },
    select: { id: true },
  });
  return subject.id;
}

export const documentRepository = {
  list: (page: number, limit: number, filters: { schoolId?: number, subjectId?: number, type?: DocumentType, search?: string, schoolName?: string, subjectName?: string, status?: DocumentStatus, isAdmin?: boolean }) => {
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
    };
    if (!filters.isAdmin) {
      where.status = DocumentStatus.APPROVED;
      where.school = { is: { deletedAt: null } };
      where.subject = { is: { deletedAt: null } };
    } else if (filters.status) {
      where.status = filters.status;
    }
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.schoolName?.trim()) {
      where.school = {
        is: {
          deletedAt: null,
          name: { contains: filters.schoolName.trim(), mode: "insensitive" },
        },
      };
    }
    if (filters.subjectName?.trim()) {
      where.subject = {
        is: {
          deletedAt: null,
          name: { contains: filters.subjectName.trim(), mode: "insensitive" },
        },
      };
    }
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
  activeSubscription: (userId: number) =>
    prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      select: { id: true },
    }),
  userCreditBalance: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
  creditUnlock: (userId: number, documentId: number) =>
    prisma.creditTransaction.findFirst({
      where: { userId, documentId, type: CREDIT_UNLOCK_TYPE },
      select: { id: true },
    }),
  unlockWithCredit: (userId: number, documentId: number, amount: number) =>
    prisma.$transaction(async (tx) => {
      const existingUnlock = await tx.creditTransaction.findFirst({
        where: { userId, documentId, type: CREDIT_UNLOCK_TYPE },
        select: { id: true },
      });
      if (existingUnlock) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
        return { charged: false, creditBalance: user?.creditBalance ?? 0 };
      }

      const updated = await tx.user.updateMany({
        where: { id: userId, creditBalance: { gte: amount } },
        data: { creditBalance: { decrement: amount } },
      });
      if (updated.count === 0) return null;

      await tx.creditTransaction.create({
        data: { userId, documentId, type: CREDIT_UNLOCK_TYPE, amount: -amount },
      });
      const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
      return { charged: true, creditBalance: user?.creditBalance ?? 0 };
    }),
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
        requestedSchoolName: data.requestedSchoolName, requestedSubjectName: data.requestedSubjectName,
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
      const current = await tx.document.findUnique({
        where: { id },
        select: {
          schoolId: true,
          subjectId: true,
          requestedSchoolName: true,
          requestedSubjectName: true,
        },
      });
      if (!current) {
        throw new Error("Document not found");
      }

      const schoolId = current.schoolId
        ?? (current.requestedSchoolName ? await findOrCreateSchool(tx, current.requestedSchoolName) : null);
      const subjectId = current.subjectId
        ?? (schoolId && current.requestedSubjectName ? await findOrCreateSubject(tx, schoolId, current.requestedSubjectName) : null);

      const document = await tx.document.update({
        where: { id },
        data: { schoolId, subjectId, status: DocumentStatus.APPROVED, approvedBy: moderatorId, approvedAt: new Date(), rejectReason: null },
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
