import { UserRole } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { documentService } from "../document/document.service";
import { downloadRepository } from "./download.repository";

type Actor = { userId: number; role: UserRole };

export const downloadService = {
  /** Kiểm tra quyền và ghi nhận một lượt tải tài liệu. */
  async download(actor: Actor, documentId: number) {
    const document = await downloadRepository.findDocument(documentId);
    if (!document || !document.documentFile) throw new AppError("Document is unavailable for download", 404);
    await documentService.recordDownload(documentId, actor);
    return { fileUrl: `/documents/${documentId}/file?download=1` };
  },
  /** Lấy lịch sử tải tài liệu của user. */
  async history(userId: number, page: number, limit: number) {
    const [items, total] = await downloadRepository.history(userId, page, limit);
    return paginated(items, total, page, limit);
  },
};
