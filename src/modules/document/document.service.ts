import { DocumentStatus, ReactionType, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppError } from "../../middlewares/errorHandler";
import { sendDocumentApprovedEmail } from "../../utils/email";
import { paginated } from "../../utils/pagination";
import { generateDocumentPreview, previewPageCount } from "../../utils/preview";
import { uploadDocumentFile, uploadDocumentPreviewImage } from "../../utils/storage";
import { documentRepository, NewDocumentData } from "./document.repository";

type Actor = { userId: number; role: UserRole } | undefined;
const DOCUMENT_UNLOCK_CREDIT_COST = 1;

/** Kiểm tra actor có quyền kiểm duyệt hay không. */
function isAdmin(actor: Actor) {
  return actor?.role === UserRole.ADMIN;
}

/** Tính số trang preview được phép xem miễn phí. */
function previewPageLimit(totalPages?: number | null, previewCount = 0) {
  const pageCount = totalPages || previewCount;
  if (!pageCount) return 0;
  return previewPageCount(pageCount);
}

/** Tính quyền truy cập và trạng thái mở khóa tài liệu của actor. */
async function accessInfo(document: Awaited<ReturnType<typeof documentRepository.findDetail>>, actor: Actor) {
  const owner = Boolean(document && actor?.userId === document.uploaderId);
  const admin = isAdmin(actor);
  if (!document || !actor?.userId) {
    return {
      canViewFull: false,
      isOwner: owner,
      hasPremium: false,
      hasCreditAccess: false,
      creditBalance: null,
      creditCost: DOCUMENT_UNLOCK_CREDIT_COST,
      canUnlockWithCredits: false,
    };
  }

  const [subscription, credit, existingCreditUnlock] = await Promise.all([
    owner || admin ? Promise.resolve(null) : documentRepository.activeSubscription(actor.userId),
    documentRepository.userCreditBalance(actor.userId),
    owner || admin ? Promise.resolve(null) : documentRepository.creditUnlock(actor.userId, document.id),
  ]);
  let creditBalance = credit?.creditBalance ?? 0;
  let hasCreditAccess = Boolean(existingCreditUnlock);

  return {
    canViewFull: owner || admin || Boolean(subscription) || hasCreditAccess,
    isOwner: owner,
    hasPremium: Boolean(subscription),
    hasCreditAccess,
    creditBalance,
    creditCost: DOCUMENT_UNLOCK_CREDIT_COST,
    canUnlockWithCredits: !owner && !admin && !subscription && !hasCreditAccess && creditBalance >= DOCUMENT_UNLOCK_CREDIT_COST,
  };
}

/** Chuyển loại file nội bộ thành content type HTTP. */
function fileContentType(fileType: string) {
  switch (fileType) {
    case "PDF":
      return "application/pdf";
    case "DOCX":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "PPTX":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return "application/octet-stream";
  }
}

/** Chọn tên file tải về từ metadata tài liệu. */
function fileName(document: NonNullable<Awaited<ReturnType<typeof documentRepository.findDetail>>>) {
  const original = document.documentFile?.originalFilename?.trim();
  if (original) return original;
  const fallbackExtension = document.documentFile?.fileType?.toLowerCase() || "bin";
  return `${document.title}.${fallbackExtension}`.replace(/[\\/:*?"<>|]+/g, "-");
}

/** Tạo URL thumbnail tối ưu nếu ảnh nằm trên Cloudinary. */
function thumbnailUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (!imageUrl.includes("/upload/")) return imageUrl;
  return imageUrl.replace("/upload/", "/upload/f_auto,q_auto,w_480/");
}

/** Chuẩn hóa tên trường/môn tự nhập. */
function normalizeName(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

/** Chuẩn hóa payload chi tiết tài liệu theo quyền xem. */
async function documentDetailPayload(
  document: NonNullable<Awaited<ReturnType<typeof documentRepository.findDetail>>>,
  actor: Actor,
  previewOnly = false,
) {
  const access = await accessInfo(document, actor);
  const previewLimit = previewPageLimit(document.documentFile?.totalPages, document.previews.length);
  const reactionCounts = await documentRepository.reactionCounts(document.id);
  const myReaction = actor?.userId ? await documentRepository.findReaction(document.id, actor.userId) : null;
  const likeCount = reactionCounts.find((reaction) => reaction.type === ReactionType.LIKE)?._count.type ?? 0;
  const dislikeCount = reactionCounts.find((reaction) => reaction.type === ReactionType.DISLIKE)?._count.type ?? 0;
  const documentFile = document.documentFile
    ? {
        ...document.documentFile,
        fileUrl: null,
      }
    : null;

  return {
    ...document,
    accessInfo: access,
    reactionInfo: {
      likeCount,
      dislikeCount,
      myReaction: myReaction?.type ?? null,
    },
    documentFile,
    previews: access.canViewFull && !previewOnly
      ? document.previews
      : document.previews.filter((page) => page.pageNumber <= previewLimit),
  };
}

export const documentService = {
  /** Lấy danh sách tài liệu và rút gọn metadata cho card/list. */
  async list(
    page: number,
    limit: number,
    filters: {
      schoolId?: number;
      subjectId?: number;
      type?: NewDocumentData["documentType"];
      search?: string;
      schoolName?: string;
      subjectName?: string;
      status?: DocumentStatus;
    },
    actor?: Actor,
  ) {
    const isAdminActor = actor?.role === UserRole.ADMIN;
    const [items, total] = await documentRepository.list(page, limit, {
      schoolId: filters.schoolId,
      subjectId: filters.subjectId,
      type: filters.type,
      search: filters.search,
      schoolName: filters.schoolName,
      subjectName: filters.subjectName,
      status: filters.status,
      isAdmin: isAdminActor,
    });
    return paginated(
      items.map((item) => ({
        ...item,
        coverImageUrl: thumbnailUrl(item.previews[0]?.imageUrl),
        totalPages: item.documentFile?.totalPages ?? null,
        documentFile: undefined,
        previews: undefined,
      })),
      total,
      page,
      limit,
    );
  },

  /** Lấy chi tiết tài liệu và ghi nhận lượt xem. */
  async detail(id: number, actor: Actor, previewOnly = false) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    const owner = actor?.userId === document.uploaderId;
    if (document.status !== DocumentStatus.APPROVED && !owner && !isAdmin(actor)) {
      throw new AppError("Document not found", 404);
    }
    await documentRepository.incrementView(id);
    if (actor?.userId) {
      await documentRepository.recordUserView(id, actor.userId);
    }

    return documentDetailPayload(document, actor, previewOnly);
  },

  /** Kiểm tra quyền và trả thông tin file được bảo vệ. */
  async protectedFile(documentId: number, actor: Actor, download = false) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    const owner = actor.userId === document.uploaderId;
    if (document.status !== DocumentStatus.APPROVED && !owner && !isAdmin(actor)) {
      throw new AppError("Document not found", 404);
    }
    if (!document.documentFile?.fileUrl) throw new AppError("Document file not found", 404);
    if (!(await accessInfo(document, actor)).canViewFull) {
      throw new AppError("Premium or credit is required to view the full file", 403);
    }

    return {
      fileUrl: document.documentFile.fileUrl,
      contentType: fileContentType(document.documentFile.fileType),
      filename: fileName(document),
      disposition: download ? "attachment" : "inline",
    };
  },

  /** Tạo tài liệu mới, upload file và sinh preview nếu có file đính kèm. */
  async create(input: Omit<NewDocumentData, "uploaderId" | "file"> & NewDocumentData["file"], uploaderId: number, uploaded?: Express.Multer.File) {
    const requestedSchoolName = normalizeName(input.requestedSchoolName);
    const requestedSubjectName = normalizeName(input.requestedSubjectName);
    if (!input.schoolId && !requestedSchoolName) {
      throw new AppError("Vui lòng chọn hoặc nhập trường học.", 400);
    }
    if (!input.subjectId && !requestedSubjectName) {
      throw new AppError("Vui lòng chọn hoặc nhập môn học.", 400);
    }

    const generatedPreview = uploaded ? await generateDocumentPreview(uploaded, input.fileType) : null;
    const totalPages = generatedPreview?.totalPages ?? input.totalPages;
    if (totalPages && totalPages < 3) {
      throw new AppError("Tai lieu phai co toi thieu 3 trang.", 400);
    }
    const fileUrl = uploaded ? await uploadDocumentFile(uploaded) : input.fileUrl;
    if (!fileUrl) throw new AppError("A document file or fileUrl is required", 400);
    if (!uploaded && (!input.previews?.length || !input.totalPages)) {
      throw new AppError("Preview data is required when creating a document from fileUrl", 400);
    }

    const previewBatchId = randomUUID();
    const generatedPreviews = generatedPreview
      ? await Promise.all(generatedPreview.pages.map(async (page) => ({
          pageNumber: page.pageNumber,
          imageUrl: await uploadDocumentPreviewImage(
            page.image,
            `academic-document-previews/${previewBatchId}/page-${page.pageNumber}`,
          ),
          isBlurred: false,
        })))
      : undefined;

    return documentRepository.create({
      uploaderId,
      schoolId: input.schoolId ?? null,
      subjectId: input.subjectId ?? null,
      requestedSchoolName: input.schoolId ? null : requestedSchoolName,
      requestedSubjectName: input.subjectId ? null : requestedSubjectName,
      title: input.title,
      description: input.description, documentType: input.documentType,
      file: {
        fileUrl,
        originalFilename: input.originalFilename ?? uploaded?.originalname ?? "document",
        fileType: input.fileType, fileSize: input.fileSize ?? uploaded?.size ?? 1,
        totalPages, storageProvider: uploaded ? "CLOUDINARY" : input.storageProvider,
      },
      previews: generatedPreviews ?? input.previews,
    });
  },

  /** Cập nhật reaction của user với tài liệu. */
  async react(documentId: number, actor: Actor, type: ReactionType | null) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    if (document.status !== DocumentStatus.APPROVED && actor.userId !== document.uploaderId && !isAdmin(actor)) {
      throw new AppError("Document not found", 404);
    }
    if (!(await accessInfo(document, actor)).canViewFull) {
      throw new AppError("Premium or credit is required to react", 403);
    }

    if (type) {
      await documentRepository.setReaction(documentId, actor.userId, type);
    } else {
      await documentRepository.removeReaction(documentId, actor.userId);
    }

    const counts = await documentRepository.reactionCounts(documentId);
    return {
      likeCount: counts.find((reaction) => reaction.type === ReactionType.LIKE)?._count.type ?? 0,
      dislikeCount: counts.find((reaction) => reaction.type === ReactionType.DISLIKE)?._count.type ?? 0,
      myReaction: type,
    };
  },

  /** Cho phép chủ sở hữu cập nhật metadata tài liệu. */
  async update(id: number, userId: number, data: Record<string, unknown>) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    if (document.uploaderId !== userId) throw new AppError("You can only update your own document", 403);
    return documentRepository.update(id, data);
  },

  /** Mở khóa tài liệu bằng credit trong tài khoản user. */
  async unlockWithCredit(documentId: number, actor: Actor) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    const owner = actor.userId === document.uploaderId;
    if (document.status !== DocumentStatus.APPROVED && !owner && !isAdmin(actor)) {
      throw new AppError("Document not available", 403);
    }

    const currentAccess = await accessInfo(document, actor);
    if (currentAccess.canViewFull) {
      return {
        charged: false,
        creditCost: DOCUMENT_UNLOCK_CREDIT_COST,
        creditBalance: currentAccess.creditBalance,
        accessInfo: currentAccess,
        document: await documentDetailPayload(document, actor),
      };
    }
    if ((currentAccess.creditBalance ?? 0) < DOCUMENT_UNLOCK_CREDIT_COST) {
      throw new AppError("Not enough credit to unlock this document", 403);
    }

    const unlock = await documentRepository.unlockWithCredit(actor.userId, documentId, DOCUMENT_UNLOCK_CREDIT_COST);
    if (!unlock) {
      throw new AppError("Not enough credit to unlock this document", 403);
    }

    const unlockedDocument = await documentRepository.findDetail(documentId);
    if (!unlockedDocument) throw new AppError("Document not found", 404);
    const payload = await documentDetailPayload(unlockedDocument, actor);

    return {
      charged: unlock.charged,
      creditCost: DOCUMENT_UNLOCK_CREDIT_COST,
      creditBalance: unlock.creditBalance,
      accessInfo: payload.accessInfo,
      document: payload,
    };
  },

  /** Xóa mềm tài liệu nếu user là chủ sở hữu hoặc admin. */
  async remove(id: number, userId: number, role: UserRole) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    const isAdminActor = role === UserRole.ADMIN;
    if (!isAdminActor && document.uploaderId !== userId) {
      throw new AppError("You can only delete your own document", 403);
    }
    await documentRepository.remove(id);
    return { message: "Document deleted" };
  },

  /** Duyệt tài liệu và cộng thưởng credit nếu đủ điều kiện. */
  async approve(id: number, adminId: number) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    if (!document.schoolId && !normalizeName(document.requestedSchoolName)) {
      throw new AppError("Không thể duyệt vì tài liệu chưa có trường học.", 400);
    }
    if (!document.subjectId && !normalizeName(document.requestedSubjectName)) {
      throw new AppError("Không thể duyệt vì tài liệu chưa có môn học.", 400);
    }
    const shouldNotify = document.status !== DocumentStatus.APPROVED;
    const approvedDocument = await documentRepository.approveWithReward(id, adminId, document.uploaderId, shouldNotify);
    if (shouldNotify) {
      await sendDocumentApprovedEmail({
        email: approvedDocument.uploader.email,
        fullName: approvedDocument.uploader.fullName,
        documentTitle: approvedDocument.title,
      });
    }
    return approvedDocument;
  },

  /** Từ chối tài liệu và lưu lý do. */
  async reject(id: number, adminId: number, reason: string) {
    if (!(await documentRepository.findDetail(id))) throw new AppError("Document not found", 404);
    return documentRepository.reject(id, adminId, reason);
  },
  /** Ẩn tài liệu đã duyệt khỏi danh sách công khai. */
  async hide(id: number, adminId: number) {
    if (!(await documentRepository.findDetail(id))) throw new AppError("Document not found", 404);
    return documentRepository.hide(id, adminId);
  },
  /** Bỏ ẩn tài liệu để hiển thị công khai trở lại. */
  async unhide(id: number, adminId: number) {
    if (!(await documentRepository.findDetail(id))) throw new AppError("Document not found", 404);
    return documentRepository.unhide(id, adminId);
  },

  /** Ghi nhận lượt tải sau khi kiểm tra quyền truy cập. */
  async recordDownload(documentId: number, actor: Actor) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    if (document.status !== DocumentStatus.APPROVED && actor.userId !== document.uploaderId && !isAdmin(actor)) {
      throw new AppError("Document not available", 403);
    }
    if (!(await accessInfo(document, actor)).canViewFull) {
      throw new AppError("Premium or credit is required to download", 403);
    }

    await documentRepository.recordDownload(documentId, actor.userId);
    await documentRepository.incrementDownload(documentId);

    return { message: "Download recorded" };
  },
};
