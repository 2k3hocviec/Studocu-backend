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
  findPublicById: (id: number) => prisma.user.findUnique({ where: { id }, select: publicUserSelect }),
  findPasswordById: (id: number) => prisma.user.findUnique({ where: { id }, select: { id: true, passwordHash: true } }),
  updateProfile: (id: number, data: { fullName?: string; avatarUrl?: string | null }) =>
    prisma.user.update({ where: { id }, data, select: publicUserSelect }),
  updatePassword: (id: number, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash }, select: { id: true } }),
  list: (page: number, limit: number, search?: string) => {
    const where: Prisma.UserWhereInput | undefined = search
      ? { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
      : undefined;
    return Promise.all([
      prisma.user.findMany({ where, ...pagination(page, limit), orderBy: { createdAt: "desc" }, select: publicUserSelect }),
      prisma.user.count({ where }),
    ]);
  },
  updateStatus: (id: number, status: UserStatus) =>
    prisma.user.update({ where: { id }, data: { status }, select: publicUserSelect }),
  myDocuments: (userId: number) =>
    prisma.document.findMany({
      where: { uploaderId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: profileDocumentInclude,
    }),
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
