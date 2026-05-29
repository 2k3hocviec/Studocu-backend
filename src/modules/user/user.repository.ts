import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { pagination } from "../../utils/pagination";

const publicUserSelect = {
  id: true, fullName: true, email: true, avatarUrl: true, status: true, role: true,
  creditBalance: true, createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

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
};
