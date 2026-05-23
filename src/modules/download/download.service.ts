import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { downloadRepository } from "./download.repository";

export const downloadService = {
  async download(userId: number, documentId: number) {
    const document = await downloadRepository.findDocument(documentId);
    if (!document || !document.documentFile) throw new AppError("Document is unavailable for download", 404);
    let creditUsed = 0;
    if (document.isPremium) {
      const subscription = await downloadRepository.findActiveSubscription(userId);
      const withinLimit = subscription
        ? (await downloadRepository.countSubscriptionDownloads(userId, subscription.startDate, subscription.endDate)) < subscription.plan.downloadLimit
        : false;
      if (!withinLimit) {
        const user = await downloadRepository.findUser(userId);
        if (!user || user.creditBalance < 1) throw new AppError("Insufficient credit balance", 400);
        creditUsed = 1;
      }
    }
    await downloadRepository.record(userId, documentId, creditUsed);
    return { fileUrl: document.documentFile.fileUrl, creditUsed };
  },
  async history(userId: number, page: number, limit: number) {
    const [items, total] = await downloadRepository.history(userId, page, limit);
    return paginated(items, total, page, limit);
  },
};
