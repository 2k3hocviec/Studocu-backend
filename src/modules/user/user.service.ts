import { UserStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { paginated } from "../../utils/pagination";
import { userRepository } from "./user.repository";

export const userService = {
  async getMe(userId: number) {
    const user = await userRepository.findPublicById(userId);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },
  updateMe: (userId: number, data: { fullName?: string; avatarUrl?: string | null }) =>
    userRepository.updateProfile(userId, data),
  async list(page: number, limit: number, search?: string) {
    const [items, total] = await userRepository.list(page, limit, search);
    return paginated(items, total, page, limit);
  },
  async updateStatus(userId: number, status: UserStatus) {
    try { return await userRepository.updateStatus(userId, status); }
    catch { throw new AppError("User not found", 404); }
  },
};
