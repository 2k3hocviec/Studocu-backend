import { DocumentStatus, UserRole } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { uploadDocumentFile } from "../../utils/storage";
import { documentRepository, NewDocumentData } from "./document.repository";

type Actor = { userId: number; role: UserRole } | undefined;

function isModerator(actor: Actor) {
  return actor?.role === UserRole.ADMIN || actor?.role === UserRole.MODERATOR;
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
    return paginated(items, total, page, limit);
  },

  async detail(id: number, actor: Actor) {
    const document = await documentRepository.findDetail(id);
    if (!document) throw new AppError("Document not found", 404);
    const owner = actor?.userId === document.uploaderId;
    if (document.status !== DocumentStatus.APPROVED && !owner && !isModerator(actor)) {
      throw new AppError("Document not found", 404);
    }
    await documentRepository.incrementView(id);
    const premiumAccess = actor ? Boolean(await documentRepository.findActiveSubscription(actor.userId)) : false;
    const fullAccess = owner || isModerator(actor) || premiumAccess;
    const previewLimit = actor ? 3 : 2;
    return {
      ...document,
      documentFile: fullAccess ? document.documentFile : undefined,
      previews: fullAccess ? document.previews : document.previews.filter((page) => page.pageNumber <= previewLimit),
    };
  },

  async create(input: Omit<NewDocumentData, "uploaderId" | "file"> & NewDocumentData["file"], uploaderId: number, uploaded?: Express.Multer.File) {
    const fileUrl = uploaded ? await uploadDocumentFile(uploaded) : input.fileUrl;
    if (!fileUrl) throw new AppError("A document file or fileUrl is required", 400);
    return documentRepository.create({
      uploaderId, schoolId: input.schoolId, subjectId: input.subjectId, title: input.title,
      description: input.description, documentType: input.documentType, isPremium: input.isPremium,
      file: {
        fileUrl, previewUrl: input.previewUrl,
        originalFilename: input.originalFilename ?? uploaded?.originalname ?? "document",
        fileType: input.fileType, fileSize: input.fileSize ?? uploaded?.size ?? 1,
        totalPages: input.totalPages, storageProvider: input.storageProvider,
      },
      previews: input.previews,
    });
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
};
