import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { authService } from "./auth.service";

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
  try { sendSuccess(res, await authService.login(req.body)); } catch (error) { next(error); }
};

/** Làm mới access token từ refresh token. */
export const refreshToken: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.refresh(req.body.refreshToken)); } catch (error) { next(error); }
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
  try { sendSuccess(res, authService.logout(req.body.refreshToken)); } catch (error) { next(error); }
};
