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

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function issueOtp(email: string, type: OtpType) {
  const otpCode = generateOtp();
  const expiredAt = new Date(Date.now() + 10 * 60 * 1000);
  await authRepository.createOtp(email, otpCode, type, expiredAt);
  await sendOtpEmail(email, otpCode, type === OtpType.VERIFY_EMAIL ? "Email verification" : "Password reset");
  return env.NODE_ENV === "production" ? undefined : otpCode;
}

function tokens(user: { id: number; email: string; role: "USER" | "ADMIN" | "MODERATOR" }) {
  const payload = { userId: user.id, email: user.email, role: user.role };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
}

export const authService = {
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

  async verifyEmail(email: string, otpCode: string) {
    const otp = await authRepository.findValidOtp(email, otpCode, OtpType.VERIFY_EMAIL);
    if (!otp) throw new AppError("Invalid or expired OTP", 400);
    await authRepository.markOtpUsed(otp.id);
    await authRepository.activateUser(email);
    return { message: "Email verified successfully" };
  },

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

  async forgotPassword(email: string) {
    if (await authRepository.findUserByEmail(email)) {
      const debugOtp = await issueOtp(email, OtpType.FORGOT_PASSWORD);
      return { message: "Password reset OTP sent if the account exists", debugOtp };
    }
    return { message: "Password reset OTP sent if the account exists" };
  },

  async resetPassword(email: string, otpCode: string, password: string) {
    const otp = await authRepository.findValidOtp(email, otpCode, OtpType.FORGOT_PASSWORD);
    if (!otp) throw new AppError("Invalid or expired OTP", 400);
    await authRepository.markOtpUsed(otp.id);
    await authRepository.updatePassword(email, await hashPassword(password));
    return { message: "Password reset successfully" };
  },

  logout(refreshToken: string) {
    try {
      revokeRefreshToken(refreshToken);
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }
    return { message: "Logged out successfully" };
  },
};
