import { DocumentStatus, FileType, ReactionType, UserRole } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { sendDocumentApprovedEmail } from "../../utils/email";
import { paginated } from "../../utils/pagination";
import { convertOfficeBufferToPdf } from "../../utils/preview";
import { generateDocumentPreview, previewPageCount } from "../../utils/preview";
import {
  deleteAllDocumentAssets,
  generateCloudinarySignedUrl,
  signedCloudinaryRawDownloadUrl,
  uploadConvertedPdfBuffer,
  uploadDocumentFile,
  uploadDocumentPreviewImage,
} from "../../utils/storage";
import { documentRepository, NewDocumentData } from "./document.repository";

type Actor = { userId: number; role: UserRole } | undefined;
const DOCUMENT_UNLOCK_CREDIT_COST = 1;

/** Tải file từ remote URL (Cloudinary hoặc URL khác). */
async function fetchRemoteFile(url: string): Promise<Buffer> {
  const signed = signedCloudinaryRawDownloadUrl(url) ?? url;
  const upstream = await fetch(signed).catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new AppError(`Document file storage request failed: ${message}`, 502);
  });
  if (!upstream.ok) {
    throw new AppError(`Document file unavailable from storage (${upstream.status})`, 502);
  }
  return Buffer.from(await upstream.arrayBuffer());
}

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
        /** Signed Cloudinary URL — dùng cho frontend fetch trực tiếp thay vì qua backend proxy.
         *  Tránh buffer file trong RAM ở backend. Hết hạn sau 1 giờ. */
        viewableUrl: (() => {
          if (!access.canViewFull) return null;
          const sourceUrl = document.documentFile!.convertedPdfUrl ?? document.documentFile!.fileUrl;
          if (!sourceUrl) return null;
          // Nếu URL đã là Cloudinary signed URL (từ download endpoint), dùng trực tiếp
          if (sourceUrl.includes("?sig=") || sourceUrl.includes("&sig=")) return sourceUrl;
          return generateCloudinarySignedUrl(sourceUrl, 3600);
        })(),
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

  /** Trả buffer PDF để stream về client — dùng convertedPdfUrl trên Cloudinary
   *  nếu có, fallback convert on-demand cho document cũ chưa có. */
  async getViewableBuffer(documentId: number, actor: Actor) {
    // protectedFile đã kiểm tra quyền → throw nếu không đủ quyền
    const { fileUrl } = await this.protectedFile(documentId, actor, false);
    const document = await documentRepository.findDetail(documentId);
    const fileType = document!.documentFile!.fileType;
    const convertedPdfUrl = document!.documentFile!.convertedPdfUrl;

    // Đã có converted PDF trên Cloudinary: stream thẳng
    if (convertedPdfUrl) {
      const buffer = await fetchRemoteFile(convertedPdfUrl);
      return {
        buffer,
        contentType: "application/pdf",
        filename: fileName(document!).replace(/\.(pdf|docx|pptx)$/i, ".pdf"),
        disposition: "inline",
      };
    }

    // Chưa có converted PDF: convert on-demand rồi lưu ngược lên Cloudinary
    const rawBuffer = await fetchRemoteFile(fileUrl);

    if (fileType === "PDF") {
      // File gốc đã là PDF nhưng DB chưa ghi nhận convertedPdfUrl → set luôn
      await documentRepository.updateConvertedPdfUrl(documentId, fileUrl);
      return {
        buffer: rawBuffer,
        contentType: "application/pdf",
        filename: fileName(document!).replace(/\.pdf$/i, ".pdf"),
        disposition: "inline",
      };
    }

    // DOCX / PPTX: convert → upload → lưu URL
    const { pdf } = await convertOfficeBufferToPdf(rawBuffer, fileType as "DOCX" | "PPTX");
    const newConvertedUrl = await uploadConvertedPdfBuffer(pdf, documentId);
    await documentRepository.updateConvertedPdfUrl(documentId, newConvertedUrl);

    return {
      buffer: pdf,
      contentType: "application/pdf",
      filename: fileName(document!).replace(/\.(docx|pptx)$/i, ".pdf"),
      disposition: "inline",
    };
  },

  /** Tạo tài liệu mới, upload file và sinh preview nếu có file đính kèm.
   *  Nếu file là DOCX/PPTX, convert sang PDF ngay lúc upload và lưu lên Cloudinary.
   *  Flow 2-phase: tạo skeleton Document trước để lấy documentId, dùng documentId để
   *  upload Cloudinary (mọi asset được tag doc:{id}), sau đó update URL thật. */
  async create(input: Omit<NewDocumentData, "uploaderId" | "file"> & NewDocumentData["file"], uploaderId: number, uploaded?: Express.Multer.File) {
    const requestedSchoolName = normalizeName(input.requestedSchoolName);
    const requestedSubjectName = normalizeName(input.requestedSubjectName);
    if (!input.schoolId && !requestedSchoolName) {
      throw new AppError("Vui lòng chọn hoặc nhập trường học.", 400);
    }
    if (!input.subjectId && !requestedSubjectName) {
      throw new AppError("Vui lòng chọn hoặc nhập môn học.", 400);
    }

    if (uploaded) {
      // Phase 0: validate magic bytes + sinh preview từ buffer trước khi tạo DB
      // Với DOCX/PPTX: preview PDF buffer được reuse ở Phase 3 thay vì convert lại
      const generatedPreview = await generateDocumentPreview(uploaded, input.fileType);
      const totalPages = generatedPreview.totalPages;
      if (totalPages && totalPages < 3) {
        throw new AppError("Tai lieu phai co toi thieu 3 trang.", 400);
      }

      // Phase 1: tạo skeleton Document với placeholder URL để lấy documentId
      const skeleton = await documentRepository.createSkeleton({
        uploaderId,
        schoolId: input.schoolId ?? null,
        subjectId: input.subjectId ?? null,
        requestedSchoolName: input.schoolId ? null : requestedSchoolName,
        requestedSubjectName: input.subjectId ? null : requestedSubjectName,
        title: input.title,
        description: input.description ?? null,
        documentType: input.documentType,
        fileType: input.fileType,
        fileSize: uploaded.size,
        originalFilename: uploaded.originalname || "document",
        totalPages,
      });
      const documentId = skeleton.id;

      // Phase 2: upload file gốc lên Cloudinary với tag doc:{documentId}
      let fileUrl: string;
      try {
        fileUrl = await uploadDocumentFile(uploaded, input.fileType, documentId);
      } catch (error) {
        await documentRepository.remove(documentId).catch(() => undefined);
        throw error;
      }

      // Phase 3: DOCX/PPTX → upload converted PDF
      // PDF buffer đã có từ Phase 0 → reuse, KHÔNG convert lại
      let convertedPdfUrl: string | null = null;
      if (input.fileType === "PDF") {
        convertedPdfUrl = fileUrl;
      } else {
        try {
          // generatedPreview.pdfBuffer đã chứa kết quả convert từ Phase 0
          convertedPdfUrl = await uploadConvertedPdfBuffer(generatedPreview.pdfBuffer!, documentId);
        } catch (error) {
          await deleteAllDocumentAssets(documentId).catch(() => undefined);
          await documentRepository.remove(documentId).catch(() => undefined);
          throw error;
        }
      }

      // Phase 4: upload preview pages lên previews/{documentId}/
      let previews: Array<{ pageNumber: number; imageUrl: string; isBlurred: boolean }>;
      try {
        previews = await Promise.all(
          generatedPreview.pages.map(async (page) => ({
            pageNumber: page.pageNumber,
            imageUrl: await uploadDocumentPreviewImage(page.image, documentId, page.pageNumber),
            isBlurred: false,
          })),
        );
      } catch (error) {
        await deleteAllDocumentAssets(documentId).catch(() => undefined);
        await documentRepository.remove(documentId).catch(() => undefined);
        throw error;
      }

      // Phase 5: update DocumentFile với URL thật + insert previews
      return documentRepository.finalizeUpload(documentId, {
        fileUrl,
        convertedPdfUrl,
        previews,
      });
    }

    // Branch tạo từ URL có sẵn (ít dùng, không qua Multer)
    if (!input.fileUrl) throw new AppError("A document file or fileUrl is required", 400);
    if (!input.previews?.length || !input.totalPages) {
      throw new AppError("Preview data is required when creating a document from fileUrl", 400);
    }
    const convertedPdfUrl = input.convertedPdfUrl !== undefined ? input.convertedPdfUrl : null;
    return documentRepository.create({
      uploaderId,
      schoolId: input.schoolId ?? null,
      subjectId: input.subjectId ?? null,
      requestedSchoolName: input.schoolId ? null : requestedSchoolName,
      requestedSubjectName: input.subjectId ? null : requestedSubjectName,
      title: input.title,
      description: input.description,
      documentType: input.documentType,
      file: {
        fileUrl: input.fileUrl,
        originalFilename: input.originalFilename ?? "document",
        fileType: input.fileType,
        fileSize: input.fileSize ?? 1,
        totalPages: input.totalPages,
        storageProvider: input.storageProvider,
        convertedPdfUrl,
      },
      previews: input.previews,
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

  /** Xóa mềm tài liệu và dọn sạch toàn bộ asset Cloudinary theo tag doc:{id}. */
  async remove(id: number, userId: number, role: UserRole) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    const isAdminActor = role === UserRole.ADMIN;
    if (!isAdminActor && document.uploaderId !== userId) {
      throw new AppError("You can only delete your own document", 403);
    }

    await documentRepository.remove(id);

    // Xóa mọi asset (file gốc + converted PDF + tất cả preview) bằng tag doc:{id}
    await deleteAllDocumentAssets(id).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[cleanup] Cloudinary bulk delete failed for document ${id}: ${message}`);
    });

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
