import { OtpType, Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const authRepository = {
  findUserByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  createUser: (data: Prisma.UserCreateInput) => prisma.user.create({ data }),
  updatePassword: (email: string, passwordHash: string) =>
    prisma.user.update({ where: { email }, data: { passwordHash } }),
  activateUser: (email: string) =>
    prisma.user.update({ where: { email }, data: { status: UserStatus.ACTIVE } }),
  createOtp: (email: string, otpCode: string, type: OtpType, expiredAt: Date) =>
    prisma.emailOtp.create({ data: { email, otpCode, type, expiredAt } }),
  findValidOtp: (email: string, otpCode: string, type: OtpType) =>
    prisma.emailOtp.findFirst({
      where: { email, otpCode, type, used: false, expiredAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  markOtpUsed: (id: number) => prisma.emailOtp.update({ where: { id }, data: { used: true } }),
};
