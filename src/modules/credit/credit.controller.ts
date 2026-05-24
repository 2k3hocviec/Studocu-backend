import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { creditService } from "./credit.service";

export const balance: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await creditService.balance(req.user!.userId)); } catch (error) { next(error); }
};
export const transactions: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await creditService.transactions(req.user!.userId, Number(req.query.page), Number(req.query.limit), req.query.documentId ? Number(req.query.documentId) : undefined)); } catch (error) { next(error); }
};

export const adminAdjust: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await creditService.adminAdjust(req.body.userId, req.body.amount)); } catch (error) { next(error); }
};
