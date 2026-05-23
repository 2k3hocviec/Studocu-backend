import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { paymentService } from "./payment.service";

export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await paymentService.create(req.user!.userId, req.body.planId, req.body.method), 201); } catch (error) { next(error); }
};
export const mockConfirm: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await paymentService.mockConfirm(req.user!.userId, Number(req.params.id))); } catch (error) { next(error); }
};
export const history: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await paymentService.history(req.user!.userId, Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
