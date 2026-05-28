import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { userService } from "./user.service";

export const getMe: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.getMe(req.user!.userId)); } catch (error) { next(error); }
};
export const updateMe: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.updateMe(req.user!.userId, req.body)); } catch (error) { next(error); }
};
export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.list(Number(req.query.page), Number(req.query.limit), req.query.search as string | undefined)); } catch (error) { next(error); }
};
export const updateStatus: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await userService.updateStatus(Number(req.params.id), req.body.status)); } catch (error) { next(error); }
};
