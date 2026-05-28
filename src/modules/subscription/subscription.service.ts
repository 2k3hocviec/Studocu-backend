import { paginated } from "../../utils/pagination";
import { subscriptionRepository } from "./subscription.repository";

export const subscriptionService = {
  async plans(page: number, limit: number) {
    const [items, total] = await subscriptionRepository.listPlans(page, limit);
    return paginated(items, total, page, limit);
  },
  me: (userId: number) => subscriptionRepository.activeForUser(userId),
};
