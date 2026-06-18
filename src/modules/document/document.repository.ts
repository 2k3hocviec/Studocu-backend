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
    convertedPdfUrl?: string | null;
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

/** Tạo slug URL an toàn từ tên trường hoặc môn học. */
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

/** Tạo slug duy nhất trong bảng school hoặc subject. */
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

/** Tìm hoặc tạo trường học theo tên người dùng nhập. */
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

/** Tìm hoặc tạo môn học trong một trường. */
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
  /** Lấy danh sách tài liệu theo bộ lọc và quyền admin/public. */
  list: (
    page: number,
    limit: number,
    filters: {
      schoolId?: number;
      subjectId?: number;
      type?: DocumentType;
      search?: string;
      schoolName?: string;
      subjectName?: string;
      status?: DocumentStatus;
      isAdmin?: boolean;
    },
  ) => {
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
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }
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
  /** Tìm chi tiết tài liệu kèm uploader, file và preview. */
  findDetail: (id: number) => prisma.document.findFirst({ where: { id, deletedAt: null }, include: detailInclude }),
  /** Tìm subscription còn hiệu lực của user. */
  activeSubscription: (userId: number) =>
    prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      select: { id: true },
    }),
  /** Lấy số dư credit của user. */
  userCreditBalance: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
  /** Kiểm tra user đã mở khóa tài liệu bằng credit chưa. */
  creditUnlock: (userId: number, documentId: number) =>
    prisma.creditTransaction.findFirst({
      where: { userId, documentId, type: CREDIT_UNLOCK_TYPE },
      select: { id: true },
    }),
  /** Trừ credit và ghi giao dịch mở khóa tài liệu. */
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
  /** Đếm số like/dislike của tài liệu. */
  reactionCounts: (documentId: number) =>
    prisma.documentReaction.groupBy({
      by: ["type"],
      where: { documentId },
      _count: { type: true },
    }),
  /** Tìm reaction hiện tại của user với tài liệu. */
  findReaction: (documentId: number, userId: number) =>
    prisma.documentReaction.findUnique({ where: { userId_documentId: { userId, documentId } } }),
  /** Tạo hoặc cập nhật reaction của user. */
  setReaction: (documentId: number, userId: number, type: ReactionType) =>
    prisma.documentReaction.upsert({
      where: { userId_documentId: { userId, documentId } },
      update: { type },
      create: { userId, documentId, type },
    }),
  /** Xóa reaction của user. */
  removeReaction: (documentId: number, userId: number) =>
    prisma.documentReaction.deleteMany({ where: { userId, documentId } }),
  /** Tăng bộ đếm lượt xem tài liệu. */
  incrementView: (id: number) => prisma.document.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
  /** Ghi nhận lần xem gần nhất của user với tài liệu. */
  recordUserView: (documentId: number, userId: number) =>
    prisma.documentView.upsert({
      where: { userId_documentId: { userId, documentId } },
      update: { viewedAt: new Date() },
      create: { userId, documentId },
    }),
  /** Cập nhật URL PDF đã convert cho document file. */
  updateConvertedPdfUrl: (documentId: number, convertedPdfUrl: string) =>
    prisma.documentFile.update({
      where: { documentId },
      data: { convertedPdfUrl },
    }),
  /** Tạo skeleton Document + DocumentFile với placeholder URL để lấy documentId trước khi upload Cloudinary. */
  createSkeleton: (data: {
    uploaderId: number;
    schoolId: number | null;
    subjectId: number | null;
    requestedSchoolName: string | null;
    requestedSubjectName: string | null;
    title: string;
    description?: string | null;
    documentType: DocumentType;
    fileType: "PDF" | "DOCX" | "PPTX";
    fileSize: number;
    originalFilename: string;
    totalPages?: number;
  }) =>
    prisma.document.create({
      data: {
        uploaderId: data.uploaderId,
        schoolId: data.schoolId,
        subjectId: data.subjectId,
        requestedSchoolName: data.requestedSchoolName,
        requestedSubjectName: data.requestedSubjectName,
        title: data.title,
        description: data.description ?? null,
        documentType: data.documentType,
        documentFile: {
          create: {
            fileUrl: "pending",
            originalFilename: data.originalFilename,
            fileType: data.fileType,
            fileSize: data.fileSize,
            totalPages: data.totalPages ?? null,
            storageProvider: "CLOUDINARY",
            convertedPdfUrl: null,
          },
        },
      },
      select: { id: true },
    }),
  /** Sau khi upload Cloudinary xong: update URL file thật + insert previews. */
  finalizeUpload: (
    documentId: number,
    data: {
      fileUrl: string;
      convertedPdfUrl: string | null;
      previews: Array<{ pageNumber: number; imageUrl: string; isBlurred: boolean }>;
    },
  ) =>
    prisma.$transaction(async (tx) => {
      await tx.documentFile.update({
        where: { documentId },
        data: { fileUrl: data.fileUrl, convertedPdfUrl: data.convertedPdfUrl },
      });
      if (data.previews.length) {
        await tx.documentPreview.createMany({
          data: data.previews.map((preview) => ({ ...preview, documentId })),
        });
      }
      return tx.document.findFirstOrThrow({
        where: { id: documentId },
        include: detailInclude,
      });
    }),
  /** Tạo tài liệu, file và các trang preview trong transaction. */
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
  /** Cập nhật metadata tài liệu. */
  update: (id: number, data: Prisma.DocumentUpdateInput) => prisma.document.update({ where: { id }, data, include: detailInclude }),
  /** Xóa mềm tài liệu. */
  remove: (id: number) => prisma.document.update({ where: { id }, data: { deletedAt: new Date() } }),
  /** Duyệt tài liệu và cộng credit thưởng nếu cần. */
  approveWithReward: (id: number, adminId: number, uploaderId: number, reward: boolean) =>
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
        data: { schoolId, subjectId, status: DocumentStatus.APPROVED, approvedBy: adminId, approvedAt: new Date(), rejectReason: null },
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
  /** Từ chối tài liệu và lưu lý do. */
  reject: (id: number, adminId: number, reason: string) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.REJECTED, approvedBy: adminId, approvedAt: new Date(), rejectReason: reason },
      include: detailInclude,
    }),
  /** Ẩn tài liệu khỏi khu vực công khai. */
  hide: (id: number, adminId: number) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.HIDDEN, approvedBy: adminId, approvedAt: new Date() },
      include: detailInclude,
    }),
  /** Khôi phục tài liệu đang bị ẩn. */
  unhide: (id: number, adminId: number) =>
    prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.APPROVED, approvedBy: adminId, approvedAt: new Date() },
      include: detailInclude,
    }),
  /** Ghi nhận lượt tải duy nhất của user với tài liệu. */
  recordDownload: (documentId: number, userId: number) =>
    prisma.download.upsert({
      where: { userId_documentId: { userId, documentId } },
      update: { downloadedAt: new Date() },
      create: {
        userId,
        documentId,
      },
    }),
  /** Tăng bộ đếm lượt tải tài liệu. */
  incrementDownload: (id: number) => prisma.document.update({ where: { id }, data: { downloadCount: { increment: 1 } } }),
};
