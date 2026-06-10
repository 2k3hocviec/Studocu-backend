import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { userService } from "./user.service";

/** Lấy thông tin user hiện tại. */
export const getMe: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.getMe(req.user!.userId)); } catch (error) { next(error); }
};
/** Cập nhật hồ sơ user hiện tại. */
export const updateMe: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.updateMe(req.user!.userId, req.body)); } catch (error) { next(error); }
};
/** Upload và cập nhật avatar của user hiện tại. */
export const updateAvatar: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.updateAvatar(req.user!.userId, req.file)); } catch (error) { next(error); }
};
/** Đổi mật khẩu của user hiện tại. */
export const changePassword: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.changePassword(req.user!.userId, req.body)); } catch (error) { next(error); }
};
/** Lấy danh sách user cho admin. */
export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.list(Number(req.query.page), Number(req.query.limit), req.query.search as string | undefined)); } catch (error) { next(error); }
};
/** Cập nhật trạng thái user. */
export const updateStatus: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.updateStatus(Number(req.params.id), req.body.status)); } catch (error) { next(error); }
};
/** Lấy tài liệu do user hiện tại đăng. */
export const myDocuments: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.myDocuments(req.user!.userId)); } catch (error) { next(error); }
};
/** Lấy tài liệu user xem gần đây. */
export const recentDocuments: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.recentDocuments(req.user!.userId, Number(req.query.limit ?? 10))); } catch (error) { next(error); }
};
