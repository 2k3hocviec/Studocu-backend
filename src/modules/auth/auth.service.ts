import { OtpType, UserStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { comparePassword, hashPassword } from "../../utils/hash";
import { sendOtpEmail } from "../../utils/email";
import {
  revokeRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { env } from "../../config/env";
import { authRepository } from "./auth.repository";
import { LoginInput, RegisterInput } from "./auth.dto";

/** Sinh mã OTP 6 chữ số. */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Tạo OTP mới, lưu vào database và gửi email cho người dùng. */
async function issueOtp(email: string, type: OtpType) {
  const otpCode = generateOtp();
  const expiredAt = new Date(Date.now() + 10 * 60 * 1000);
  await authRepository.createOtp(email, otpCode, type, expiredAt);
  await sendOtpEmail(email, otpCode, type === OtpType.VERIFY_EMAIL ? "Email verification" : "Password reset");
  return env.NODE_ENV === "production" ? undefined : otpCode;
}

/** Tạo cặp access token và refresh token cho user. */
function tokens(user: { id: number; email: string; role: "USER" | "ADMIN" }) {
  const payload = { userId: user.id, email: user.email, role: user.role };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
}

export const authService = {
  /** Đăng ký user mới và gửi OTP xác thực email. */
  async register(input: RegisterInput) {
    if (await authRepository.findUserByEmail(input.email)) {
      throw new AppError("Email is already registered", 409);
    }
    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
    });
    const debugOtp = await issueOtp(user.email, OtpType.VERIFY_EMAIL);
    return { message: "Registration successful. Verify your email with the OTP sent.", debugOtp };
  },

  /** Xác thực email khi OTP còn hạn và chưa sử dụng. */
  async verifyEmail(email: string, otpCode: string) {
    const otp = await authRepository.findValidOtp(email, otpCode, OtpType.VERIFY_EMAIL);
    if (!otp) throw new AppError("Invalid or expired OTP", 400);
    await authRepository.markOtpUsed(otp.id);
    await authRepository.activateUser(email);
    return { message: "Email verified successfully" };
  },

  /** Kiểm tra đăng nhập và cấp token nếu tài khoản đang hoạt động. */
  async login(input: LoginInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      throw new AppError("Invalid email or password", 401);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError("User account is not active", 403);
    }
    return tokens(user);
  },

  /** Xác thực refresh token và cấp lại phiên mới. */
  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }
    const user = await authRepository.findUserByEmail(payload.email);
    if (!user || user.status !== UserStatus.ACTIVE) throw new AppError("User account is not active", 403);
    revokeRefreshToken(refreshToken);
    return tokens(user);
  },

  /** Gửi OTP đặt lại mật khẩu nếu email tồn tại. */
  async forgotPassword(email: string) {
    if (await authRepository.findUserByEmail(email)) {
      const debugOtp = await issueOtp(email, OtpType.FORGOT_PASSWORD);
      return { message: "Password reset OTP sent if the account exists", debugOtp };
    }
    return { message: "Password reset OTP sent if the account exists" };
  },

  /** Đặt lại mật khẩu sau khi OTP quên mật khẩu hợp lệ. */
  async resetPassword(email: string, otpCode: string, password: string) {
    const otp = await authRepository.findValidOtp(email, otpCode, OtpType.FORGOT_PASSWORD);
    if (!otp) throw new AppError("Invalid or expired OTP", 400);
    await authRepository.markOtpUsed(otp.id);
    await authRepository.updatePassword(email, await hashPassword(password));
    return { message: "Password reset successfully" };
  },

  /** Thu hồi refresh token hiện tại. */
  logout(refreshToken: string) {
    try {
      revokeRefreshToken(refreshToken);
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }
    return { message: "Logged out successfully" };
  },
};
