import { RequestHandler } from "express";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { sendSuccess } from "../../utils/response";
import { authService } from "./auth.service";

const refreshTokenCookieName = "refreshToken";
const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
} as const;
const refreshTokenCookieClearOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/v1/auth",
} as const;

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return undefined;
  return decodeURIComponent(cookie.slice(name.length + 1));
}

function getRefreshToken(req: Parameters<RequestHandler>[0]) {
  const tokenFromCookie = readCookie(req.headers.cookie, refreshTokenCookieName);
  const tokenFromBody = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const refreshToken = tokenFromCookie ?? tokenFromBody;
  if (!refreshToken) throw new AppError("Refresh token is required", 401);
  return refreshToken;
}

/** Xử lý đăng ký tài khoản mới. */
export const register: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.register(req.body), 201); } catch (error) { next(error); }
};

/** Xác thực email bằng mã OTP. */
export const verifyEmail: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.verifyEmail(req.body.email, req.body.otpCode)); } catch (error) { next(error); }
};

/** Đăng nhập và trả về token phiên. */
export const login: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken, ...data } = await authService.login(req.body);
    res.cookie(refreshTokenCookieName, refreshToken, refreshTokenCookieOptions);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

/** Làm mới access token từ refresh token. */
export const refreshToken: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken: nextRefreshToken, ...data } = await authService.refresh(getRefreshToken(req));
    res.cookie(refreshTokenCookieName, nextRefreshToken, refreshTokenCookieOptions);
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

/** Gửi OTP đặt lại mật khẩu. */
export const forgotPassword: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.forgotPassword(req.body.email)); } catch (error) { next(error); }
};

/** Đặt lại mật khẩu bằng OTP hợp lệ. */
export const resetPassword: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.resetPassword(req.body.email, req.body.otpCode, req.body.password)); } catch (error) { next(error); }
};

/** Đăng xuất bằng cách thu hồi refresh token. */
export const logout: RequestHandler = async (req, res, next) => {
  try {
    const data = authService.logout(getRefreshToken(req));
    res.clearCookie(refreshTokenCookieName, refreshTokenCookieClearOptions);
    sendSuccess(res, data);
  } catch (error) {
    res.clearCookie(refreshTokenCookieName, refreshTokenCookieClearOptions);
    next(error);
  }
};
