import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { subscriptionService } from "./subscription.service";

export const plans: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await subscriptionService.plans(Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
export const me: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await subscriptionService.me(req.user!.userId)); } catch (error) { next(error); }
};
