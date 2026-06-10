import { ReportStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { reportRepository } from "./report.repository";

export const reportService = {
  /** Tạo báo cáo sau khi kiểm tra tài liệu tồn tại. */
  async create(reporterId: number, data: { documentId: number; reason: string; description?: string | null }) {
    const document = await reportRepository.findDocumentForReport(data.documentId);
    if (!document) throw new AppError("Document not found", 404);
    if (document.uploaderId === reporterId) {
      throw new AppError("Bạn không thể báo cáo tài liệu của chính mình.", 400);
    }
    return reportRepository.create(reporterId, data);
  },
  /** Lấy danh sách báo cáo có phân trang. */
  async list(page: number, limit: number) {
    const [items, total] = await reportRepository.list(page, limit);
    return paginated(items, total, page, limit);
  },
  /** Lấy chi tiết báo cáo theo id. */
  async detail(id: number) {
    const report = await reportRepository.findDetail(id);
    if (!report) throw new AppError("Report not found", 404);
    return report;
  },
  /** Cập nhật trạng thái xử lý của báo cáo. */
  async updateStatus(id: number, handlerId: number, status: ReportStatus) {
    if (!(await reportRepository.findById(id))) throw new AppError("Report not found", 404);
    return reportRepository.updateStatus(id, status, handlerId);
  },
};
