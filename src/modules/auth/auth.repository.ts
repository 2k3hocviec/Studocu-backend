import { OtpType, Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const authRepository = {
  /** Tìm user theo email. */
  findUserByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  /** Tạo user mới. */
  createUser: (data: Prisma.UserCreateInput) => prisma.user.create({ data }),
  /** Cập nhật mật khẩu đã hash. */
  updatePassword: (email: string, passwordHash: string) =>
    prisma.user.update({ where: { email }, data: { passwordHash } }),
  /** Kích hoạt tài khoản sau khi xác thực email. */
  activateUser: (email: string) =>
    prisma.user.update({ where: { email }, data: { status: UserStatus.ACTIVE } }),
  /** Lưu OTP cho email và loại thao tác. */
  createOtp: (email: string, otpCode: string, type: OtpType, expiredAt: Date) =>
    prisma.emailOtp.create({ data: { email, otpCode, type, expiredAt } }),
  /** Tìm OTP còn hạn, đúng loại và chưa sử dụng. */
  findValidOtp: (email: string, otpCode: string, type: OtpType) =>
    prisma.emailOtp.findFirst({
      where: { email, otpCode, type, used: false, expiredAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  /** Đánh dấu OTP đã dùng. */
  markOtpUsed: (id: number) => prisma.emailOtp.update({ where: { id }, data: { used: true } }),
};
