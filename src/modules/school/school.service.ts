import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { schoolRepository } from "./school.repository";

export const schoolService = {
  /** Lấy danh sách trường học có phân trang và tìm kiếm. */
  async list(page: number, limit: number, search?: string) {
    const [items, total] = await schoolRepository.list(page, limit, search);
    return paginated(items, total, page, limit);
  },
  /** Tạo trường học mới. */
  create: schoolRepository.create,
  /** Cập nhật trường học sau khi kiểm tra tồn tại. */
  async update(id: number, data: Record<string, unknown>) {
    if (!(await schoolRepository.findById(id))) throw new AppError("School not found", 404);
    return schoolRepository.update(id, data);
  },
  /** Xóa mềm trường học nếu không còn liên kết active. */
  async remove(id: number) {
    if (!(await schoolRepository.findById(id))) throw new AppError("School not found", 404);
    const [subjects, documents] = await schoolRepository.countActiveRelations(id);
    if (subjects > 0 || documents > 0) {
      throw new AppError("Cannot delete school because it has linked subjects or documents", 409);
    }
    await schoolRepository.remove(id);
    return { message: "School deleted" };
  },
};
