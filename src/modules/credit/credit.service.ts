import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { creditRepository } from "./credit.repository";

export const creditService = {
  async balance(userId: number) {
    const result = await creditRepository.balance(userId);
    if (!result) throw new AppError("User not found", 404);
    return result;
  },
  async transactions(userId: number, page: number, limit: number, documentId?: number) {
    const [items, total] = await creditRepository.transactions(userId, page, limit, documentId);
    return paginated(items, total, page, limit);
  },
  adminAdjust: (userId: number, amount: number) => creditRepository.adminAdjust(userId, amount),
};
