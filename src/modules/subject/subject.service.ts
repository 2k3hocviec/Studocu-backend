import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { subjectRepository } from "./subject.repository";

export const subjectService = {
  /** Lấy danh sách môn học có phân trang, lọc theo trường và tìm kiếm. */
  async list(page: number, limit: number, schoolId?: number, search?: string) {
    const [items, total] = await subjectRepository.list(page, limit, schoolId, search);
    return paginated(items, total, page, limit);
  },
  /** Tạo môn học mới. */
  create: subjectRepository.create,
  /** Cập nhật môn học sau khi kiểm tra tồn tại. */
  async update(id: number, data: Record<string, unknown>) {
    if (!(await subjectRepository.findById(id))) throw new AppError("Subject not found", 404);
    return subjectRepository.update(id, data);
  },
  /** Xóa mềm môn học nếu không còn tài liệu active. */
  async remove(id: number) {
    if (!(await subjectRepository.findById(id))) throw new AppError("Subject not found", 404);
    const documents = await subjectRepository.countActiveDocuments(id);
    if (documents > 0) {
      throw new AppError("Cannot delete subject because it has linked documents", 409);
    }
    await subjectRepository.remove(id);
    return { message: "Subject deleted" };
  },
};
