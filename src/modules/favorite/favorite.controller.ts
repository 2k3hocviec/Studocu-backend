import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { favoriteService } from "./favorite.service";

export const toggle: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await favoriteService.toggle(req.user!.userId, Number(req.params.documentId))); } catch (error) { next(error); }
};
export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await favoriteService.list(req.user!.userId, Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
