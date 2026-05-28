import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { subjectRepository } from "./subject.repository";

export const subjectService = {
  async list(page: number, limit: number, schoolId?: number, search?: string) {
    const [items, total] = await subjectRepository.list(page, limit, schoolId, search);
    return paginated(items, total, page, limit);
  },
  create: subjectRepository.create,
  async update(id: number, data: Record<string, unknown>) {
    if (!(await subjectRepository.findById(id))) throw new AppError("Subject not found", 404);
    return subjectRepository.update(id, data);
  },
  async remove(id: number) {
    if (!(await subjectRepository.findById(id))) throw new AppError("Subject not found", 404);
    await subjectRepository.remove(id);
    return { message: "Subject deleted" };
  },
};
