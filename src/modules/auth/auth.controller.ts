import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { authService } from "./auth.service";

export const register: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.register(req.body), 201); } catch (error) { next(error); }
};
export const verifyEmail: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.verifyEmail(req.body.email, req.body.otpCode)); } catch (error) { next(error); }
};
export const login: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.login(req.body)); } catch (error) { next(error); }
};
export const refreshToken: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.refresh(req.body.refreshToken)); } catch (error) { next(error); }
};
export const forgotPassword: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.forgotPassword(req.body.email)); } catch (error) { next(error); }
};
export const resetPassword: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await authService.resetPassword(req.body.email, req.body.otpCode, req.body.password)); } catch (error) { next(error); }
};
export const logout: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, authService.logout(req.body.refreshToken)); } catch (error) { next(error); }
};
