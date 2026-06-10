import { ReportStatus } from "@prisma/client";
import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { reportService } from "./report.service";

/** Tạo báo cáo tài liệu từ người dùng. */
export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.create(req.user!.userId, req.body), 201); } catch (error) { next(error); }
};
/** Lấy danh sách báo cáo cho admin. */
export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.list(Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
/** Lấy chi tiết một báo cáo. */
export const detail: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.detail(Number(req.params.id))); } catch (error) { next(error); }
};
/** Đánh dấu báo cáo đã xử lý. */
export const resolve: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.updateStatus(Number(req.params.id), req.user!.userId, ReportStatus.RESOLVED)); } catch (error) { next(error); }
};
/** Từ chối báo cáo. */
export const reject: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.updateStatus(Number(req.params.id), req.user!.userId, ReportStatus.REJECTED)); } catch (error) { next(error); }
};
