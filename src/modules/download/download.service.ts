import { UserRole } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { documentService } from "../document/document.service";
import { downloadRepository } from "./download.repository";

type Actor = { userId: number; role: UserRole };

export const downloadService = {
  async download(actor: Actor, documentId: number) {
    const document = await downloadRepository.findDocument(documentId);
    if (!document || !document.documentFile) throw new AppError("Document is unavailable for download", 404);
    await documentService.recordDownload(documentId, actor);
    return { fileUrl: `/documents/${documentId}/file?download=1` };
  },
  async history(userId: number, page: number, limit: number) {
    const [items, total] = await downloadRepository.history(userId, page, limit);
    return paginated(items, total, page, limit);
  },
};
