import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { subscriptionService } from "./subscription.service";

/** Trả về danh sách gói subscription đang mở bán. */
export const plans: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await subscriptionService.plans(Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
/** Trả về subscription còn hiệu lực của user hiện tại. */
export const me: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await subscriptionService.me(req.user!.userId)); } catch (error) { next(error); }
};
