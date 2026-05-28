import { DocumentStatus, ReactionType, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { generateDocumentPreview, previewPageCount } from "../../utils/preview";
import { uploadDocumentFile, uploadDocumentPreviewImage } from "../../utils/storage";
import { documentRepository, NewDocumentData } from "./document.repository";

type Actor = { userId: number; role: UserRole } | undefined;

function isModerator(actor: Actor) {
  return actor?.role === UserRole.ADMIN || actor?.role === UserRole.MODERATOR;
}

function previewPageLimit(totalPages?: number | null, previewCount = 0) {
  const pageCount = totalPages || previewCount;
  if (!pageCount) return 0;
  return previewPageCount(pageCount);
}

async function canViewFull(document: Awaited<ReturnType<typeof documentRepository.findDetail>>, actor: Actor) {
  if (!document || !actor?.userId) return false;
  const owner = actor.userId === document.uploaderId;
  const premiumAccess = Boolean(await documentRepository.findActiveSubscription(actor.userId));
  const hasUnlocked = Boolean(await documentRepository.hasFullAccess(document.id, actor.userId));

  return owner || isModerator(actor) || premiumAccess || hasUnlocked;
}

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

function fileName(document: NonNullable<Awaited<ReturnType<typeof documentRepository.findDetail>>>) {
  const original = document.documentFile?.originalFilename?.trim();
  if (original) return original;
  const fallbackExtension = document.documentFile?.fileType?.toLowerCase() || "bin";
  return `${document.title}.${fallbackExtension}`.replace(/[\\/:*?"<>|]+/g, "-");
}

function thumbnailUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (!imageUrl.includes("/upload/")) return imageUrl;
  return imageUrl.replace("/upload/", "/upload/f_auto,q_auto,w_480/");
}

export const documentService = {
  async list(page: number, limit: number, filters: { schoolId?: number; subjectId?: number; type?: NewDocumentData["documentType"]; search?: string; status?: DocumentStatus }, actor?: Actor) {
    const isAdmin = actor?.role === UserRole.ADMIN || actor?.role === UserRole.MODERATOR;
    const [items, total] = await documentRepository.list(page, limit, {
      schoolId: filters.schoolId,
      subjectId: filters.subjectId,
      type: filters.type,
      search: filters.search,
      status: filters.status,
      isAdmin,
    });
    return paginated(items.map((item) => ({
      ...item,
      coverImageUrl: thumbnailUrl(item.previews[0]?.imageUrl),
      totalPages: item.documentFile?.totalPages ?? null,
      documentFile: undefined,
      previews: undefined,
    })), total, page, limit);
  },

  async detail(id: number, actor: Actor, previewOnly = false) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    const owner = actor?.userId === document.uploaderId;
    if (document.status !== DocumentStatus.APPROVED && !owner && !isModerator(actor)) {
      throw new AppError("Document not found", 404);
    }
    await documentRepository.incrementView(id);

    const premiumAccess = actor ? Boolean(await documentRepository.findActiveSubscription(actor.userId)) : false;
    const hasUnlocked = actor ? Boolean(await documentRepository.hasFullAccess(id, actor.userId)) : false;
    const fullAccess = owner || isModerator(actor) || premiumAccess || hasUnlocked;

    const previewLimit = previewPageLimit(document.documentFile?.totalPages, document.previews.length);
    const reactionCounts = await documentRepository.reactionCounts(id);
    const myReaction = actor?.userId ? await documentRepository.findReaction(id, actor.userId) : null;
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
      accessInfo: {
        canViewFull: fullAccess,
        isPremium: document.isPremium,
        isOwner: owner,
        hasPremium: premiumAccess,
        hasUnlocked,
        needsUnlock: !fullAccess && Boolean(actor?.userId),
        unlockCost: 1,
      },
      reactionInfo: {
        likeCount,
        dislikeCount,
        myReaction: myReaction?.type ?? null,
      },
      documentFile,
      previews: fullAccess && !previewOnly
        ? document.previews
        : document.previews.filter((page) => page.pageNumber <= previewLimit),
    };
  },

  async protectedFile(documentId: number, actor: Actor, download = false) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    const owner = actor.userId === document.uploaderId;
    if (document.status !== DocumentStatus.APPROVED && !owner && !isModerator(actor)) {
      throw new AppError("Document not found", 404);
    }
    if (!document.documentFile?.fileUrl) throw new AppError("Document file not found", 404);
    if (!(await canViewFull(document, actor))) {
      throw new AppError("Unlock this document before viewing the full file", 403);
    }

    return {
      fileUrl: document.documentFile.fileUrl,
      contentType: fileContentType(document.documentFile.fileType),
      filename: fileName(document),
      disposition: download ? "attachment" : "inline",
    };
  },

  async create(input: Omit<NewDocumentData, "uploaderId" | "file"> & NewDocumentData["file"], uploaderId: number, uploaded?: Express.Multer.File) {
    const generatedPreview = uploaded ? await generateDocumentPreview(uploaded, input.fileType) : null;
    const totalPages = generatedPreview?.totalPages ?? input.totalPages;
    if (totalPages && totalPages < 3) {
      throw new AppError("Tài liệu phải có tối thiểu 3 trang.", 400);
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
    
    const document = await documentRepository.create({
      uploaderId, schoolId: input.schoolId, subjectId: input.subjectId, title: input.title,
      description: input.description, documentType: input.documentType, isPremium: input.isPremium,
      file: {
        fileUrl, previewUrl: input.previewUrl,
        originalFilename: input.originalFilename ?? uploaded?.originalname ?? "document",
        fileType: input.fileType, fileSize: input.fileSize ?? uploaded?.size ?? 1,
        totalPages, storageProvider: input.storageProvider,
      },
      previews: generatedPreviews ?? input.previews,
    });

    return document;
  },

  async react(documentId: number, actor: Actor, type: ReactionType | null) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    if (document.status !== DocumentStatus.APPROVED && actor.userId !== document.uploaderId && !isModerator(actor)) {
      throw new AppError("Document not found", 404);
    }
    if (!(await canViewFull(document, actor))) {
      throw new AppError("Unlock this document before reacting", 403);
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

  async update(id: number, userId: number, data: Record<string, unknown>) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    if (document.uploaderId !== userId) throw new AppError("You can only update your own document", 403);
    return documentRepository.update(id, data);
  },

  async remove(id: number, userId: number, role: UserRole) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    const isAdmin = role === UserRole.ADMIN || role === UserRole.MODERATOR;
    if (!isAdmin && document.uploaderId !== userId) {
      throw new AppError("You can only delete your own document", 403);
    }
    await documentRepository.remove(id);
    return { message: "Document deleted" };
  },

  async approve(id: number, moderatorId: number) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    return documentRepository.approveWithReward(id, moderatorId, document.uploaderId, document.status !== DocumentStatus.APPROVED);
  },

  async reject(id: number, moderatorId: number, reason: string) {
    if (!(await documentRepository.findDetail(id))) throw new AppError("Document not found", 404);
    return documentRepository.reject(id, moderatorId, reason);
  },
  async hide(id: number, moderatorId: number) {
    if (!(await documentRepository.findDetail(id))) throw new AppError("Document not found", 404);
    return documentRepository.hide(id, moderatorId);
  },
  async unhide(id: number, moderatorId: number) {
    if (!(await documentRepository.findDetail(id))) throw new AppError("Document not found", 404);
    return documentRepository.unhide(id, moderatorId);
  },

  // Unlock full access - trừ credit nếu cần
  async unlockFullAccess(documentId: number, actor: Actor) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    if (document.status !== DocumentStatus.APPROVED) throw new AppError("Document not available", 403);

    const isOwner = actor.userId === document.uploaderId;
    const isPremium = Boolean(await documentRepository.findActiveSubscription(actor.userId));

    // Owner hoặc premium không cần trừ credit
    if (isOwner || isPremium) {
      return { accessGranted: true, creditCost: 0, reason: "owner_or_premium" };
    }

    // Check đã unlock chưa
    const hasAccess = await documentRepository.hasFullAccess(documentId, actor.userId);
    if (hasAccess) {
      return { accessGranted: true, creditCost: 0, reason: "already_unlocked" };
    }

    // Unlock - trừ 1 credit
    try {
      await documentRepository.unlockFullAccess(documentId, actor.userId);
      return { accessGranted: true, creditCost: 1, reason: "unlocked" };
    } catch (error) {
      if ((error as Error).message === "Insufficient credits") {
        throw new AppError("Insufficient credits to unlock this document", 402);
      }
      throw error;
    }
  },

  // Record download
  async recordDownload(documentId: number, actor: Actor) {
    if (!actor?.userId) throw new AppError("Must be logged in", 401);

    const document = await documentRepository.findDetail(documentId);
    if (!document) throw new AppError("Document not found", 404);
    if (document.status !== DocumentStatus.APPROVED) throw new AppError("Document not available", 403);

    if (!(await canViewFull(document, actor))) {
      throw new AppError("Unlock this document before downloading", 403);
    }

    // Record download
    await documentRepository.recordDownload(documentId, actor.userId);
    await documentRepository.incrementDownload(documentId);

    return { message: "Download recorded" };
  },
};
