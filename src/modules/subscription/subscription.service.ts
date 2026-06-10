import { paginated } from "../../utils/pagination";
import { subscriptionRepository } from "./subscription.repository";

export const subscriptionService = {
  /** Lấy danh sách gói subscription có phân trang. */
  async plans(page: number, limit: number) {
    const [items, total] = await subscriptionRepository.listPlans(page, limit);
    return paginated(items, total, page, limit);
  },
  /** Lấy subscription đang hoạt động của user. */
  me: (userId: number) => subscriptionRepository.activeForUser(userId),
};
