import { paginated } from "../../utils/pagination";
import { favoriteRepository } from "./favorite.repository";

export const favoriteService = {
  /** Đảo trạng thái yêu thích của tài liệu. */
  async toggle(userId: number, documentId: number) {
    const existing = await favoriteRepository.find(userId, documentId);
    if (existing) {
      await favoriteRepository.remove(existing.id);
      return { favorited: false };
    }
    await favoriteRepository.create(userId, documentId);
    return { favorited: true };
  },
  /** Lấy danh sách yêu thích có phân trang. */
  async list(userId: number, page: number, limit: number) {
    const [items, total] = await favoriteRepository.list(userId, page, limit);
    return paginated(items, total, page, limit);
  },
};
