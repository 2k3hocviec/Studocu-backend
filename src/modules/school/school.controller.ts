import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { schoolService } from "./school.service";

/** Lấy danh sách trường học. */
export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.list(Number(req.query.page), Number(req.query.limit), req.query.search as string | undefined)); } catch (error) { next(error); }
};
/** Tạo trường học mới. */
export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.create(req.body), 201); } catch (error) { next(error); }
};
/** Cập nhật thông tin trường học. */
export const update: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.update(Number(req.params.id), req.body)); } catch (error) { next(error); }
};
/** Xóa mềm trường học. */
export const remove: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await schoolService.remove(Number(req.params.id))); } catch (error) { next(error); }
};
