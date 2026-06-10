import { DocumentStatus, Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

const publicUserSelect = {
  id: true, fullName: true, email: true, avatarUrl: true, status: true, role: true,
  creditBalance: true, createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

const profileDocumentInclude = {
  school: true,
  subject: true,
  uploader: { select: { id: true, fullName: true } },
  documentFile: { select: { totalPages: true } },
  previews: {
    orderBy: { pageNumber: "asc" as const },
    take: 1,
    select: { imageUrl: true },
  },
};

export const userRepository = {
  /** Tìm thông tin công khai của user. */
  findPublicById: (id: number) => prisma.user.findUnique({ where: { id }, select: publicUserSelect }),
  /** Lấy password hash để kiểm tra đổi mật khẩu. */
  findPasswordById: (id: number) => prisma.user.findUnique({ where: { id }, select: { id: true, passwordHash: true } }),
  /** Cập nhật hồ sơ user. */
  updateProfile: (id: number, data: { fullName?: string; avatarUrl?: string | null }) =>
    prisma.user.update({ where: { id }, data, select: publicUserSelect }),
  /** Cập nhật password hash của user. */
  updatePassword: (id: number, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash }, select: { id: true } }),
  /** Lấy danh sách user có tìm kiếm. */
  list: (page: number, limit: number, search?: string) => {
    const where: Prisma.UserWhereInput | undefined = search
      ? { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
      : undefined;
    return Promise.all([
      prisma.user.findMany({ where, ...pagination(page, limit), orderBy: { createdAt: "desc" }, select: publicUserSelect }),
      prisma.user.count({ where }),
    ]);
  },
  /** Cập nhật trạng thái tài khoản user. */
  updateStatus: (id: number, status: UserStatus) =>
    prisma.user.update({ where: { id }, data: { status }, select: publicUserSelect }),
  /** Lấy tài liệu do user đăng. */
  myDocuments: (userId: number) =>
    prisma.document.findMany({
      where: { uploaderId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: profileDocumentInclude,
    }),
  /** Lấy lịch sử tài liệu user xem gần đây. */
  recentDocuments: (userId: number, limit: number) =>
    prisma.documentView.findMany({
      where: {
        userId,
        document: {
          deletedAt: null,
          OR: [
            { status: DocumentStatus.APPROVED },
            { uploaderId: userId },
          ],
        },
      },
      orderBy: { viewedAt: "desc" },
      take: limit,
      include: {
        document: { include: profileDocumentInclude },
      },
    }),
};
