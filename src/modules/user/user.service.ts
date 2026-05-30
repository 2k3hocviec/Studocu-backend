import { UserStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { comparePassword, hashPassword } from "../../utils/hash";
import { paginated } from "../../utils/pagination";
import { uploadAvatarImage } from "../../utils/storage";
import { userRepository } from "./user.repository";

export const userService = {
  async getMe(userId: number) {
    const user = await userRepository.findPublicById(userId);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },
  updateMe: (userId: number, data: { fullName?: string; avatarUrl?: string | null }) =>
    userRepository.updateProfile(userId, data),
  async updateAvatar(userId: number, file?: Express.Multer.File) {
    if (!file) throw new AppError("Vui lòng chọn file avatar PNG.", 400);
    const avatarUrl = await uploadAvatarImage(file, userId);
    return userRepository.updateProfile(userId, { avatarUrl });
  },
  async changePassword(userId: number, data: { currentPassword: string; newPassword: string }) {
    const user = await userRepository.findPasswordById(userId);
    if (!user) throw new AppError("User not found", 404);
    const isValid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!isValid) throw new AppError("Mật khẩu cũ không đúng.", 400);
    const nextHash = await hashPassword(data.newPassword);
    await userRepository.updatePassword(userId, nextHash);
    return { message: "Đã đổi mật khẩu thành công." };
  },
  async list(page: number, limit: number, search?: string) {
    const [items, total] = await userRepository.list(page, limit, search);
    return paginated(items, total, page, limit);
  },
  async updateStatus(userId: number, status: UserStatus) {
    try { return await userRepository.updateStatus(userId, status); }
    catch { throw new AppError("User not found", 404); }
  },
  async myDocuments(userId: number) {
    const items = await userRepository.myDocuments(userId);
    return items.map(profileDocument);
  },
  async recentDocuments(userId: number, limit: number) {
    const items = await userRepository.recentDocuments(userId, limit);
    return items.map((item) => ({
      ...profileDocument(item.document),
      viewedAt: item.viewedAt,
    }));
  },
};

function profileDocument(document: Awaited<ReturnType<typeof userRepository.myDocuments>>[number]) {
  return {
    ...document,
    coverImageUrl: document.previews[0]?.imageUrl ?? null,
    totalPages: document.documentFile?.totalPages ?? null,
    previews: undefined,
    documentFile: undefined,
  };
}
