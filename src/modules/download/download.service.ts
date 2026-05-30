import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { downloadRepository } from "./download.repository";

export const downloadService = {
  async download(userId: number, documentId: number) {
    const document = await downloadRepository.findDocument(documentId);
    if (!document || !document.documentFile) throw new AppError("Document is unavailable for download", 404);
    await downloadRepository.record(userId, documentId);
    return { fileUrl: `/documents/${documentId}/file?download=1` };
  },
  async history(userId: number, page: number, limit: number) {
    const [items, total] = await downloadRepository.history(userId, page, limit);
    return paginated(items, total, page, limit);
  },
};
