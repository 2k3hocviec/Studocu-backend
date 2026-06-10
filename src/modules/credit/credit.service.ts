import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { creditRepository } from "./credit.repository";

export const creditService = {
  /** Lấy số dư credit, mặc định 0 nếu không tìm thấy user. */
  async balance(userId: number) {
    const result = await creditRepository.balance(userId);
    if (!result) throw new AppError("User not found", 404);
    return result;
  },
  /** Lấy danh sách giao dịch credit có phân trang. */
  async transactions(userId: number, page: number, limit: number, documentId?: number) {
    const [items, total] = await creditRepository.transactions(userId, page, limit, documentId);
    return paginated(items, total, page, limit);
  },
  /** Cộng hoặc trừ credit thủ công cho user. */
  adminAdjust: (userId: number, amount: number) => creditRepository.adminAdjust(userId, amount),
};
