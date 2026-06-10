import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { schoolService } from "./school.service";

export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.list(Number(req.query.page), Number(req.query.limit), req.query.search as string | undefined)); } catch (error) { next(error); }
};
export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.create(req.body), 201); } catch (error) { next(error); }
};
export const update: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.update(Number(req.params.id), req.body)); } catch (error) { next(error); }
};
export const remove: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.remove(Number(req.params.id))); } catch (error) { next(error); }
};
