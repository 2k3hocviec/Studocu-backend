import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { schoolRepository } from "./school.repository";

export const schoolService = {
  async list(page: number, limit: number, search?: string) {
    const [items, total] = await schoolRepository.list(page, limit, search);
    return paginated(items, total, page, limit);
  },
  create: schoolRepository.create,
  async update(id: number, data: Record<string, unknown>) {
    if (!(await schoolRepository.findById(id))) throw new AppError("School not found", 404);
    return schoolRepository.update(id, data);
  },
  async remove(id: number) {
    if (!(await schoolRepository.findById(id))) throw new AppError("School not found", 404);
    await schoolRepository.remove(id);
    return { message: "School deleted" };
  },
};
