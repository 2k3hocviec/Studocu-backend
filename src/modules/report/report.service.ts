import { ReportStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { reportRepository } from "./report.repository";

export const reportService = {
  create: (reporterId: number, data: { documentId: number; reason: string; description?: string | null }) => reportRepository.create(reporterId, data),
  async list(page: number, limit: number) {
    const [items, total] = await reportRepository.list(page, limit);
    return paginated(items, total, page, limit);
  },
  async updateStatus(id: number, handlerId: number, status: ReportStatus) {
    if (!(await reportRepository.findById(id))) throw new AppError("Report not found", 404);
    return reportRepository.updateStatus(id, status, handlerId);
  },
};
