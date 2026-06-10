import { ReportStatus } from "@prisma/client";
import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { reportService } from "./report.service";

export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.create(req.user!.userId, req.body), 201); } catch (error) { next(error); }
};
export const list: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.list(Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
export const detail: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.detail(Number(req.params.id))); } catch (error) { next(error); }
};
export const resolve: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.updateStatus(Number(req.params.id), req.user!.userId, ReportStatus.RESOLVED)); } catch (error) { next(error); }
};
export const reject: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await reportService.updateStatus(Number(req.params.id), req.user!.userId, ReportStatus.REJECTED)); } catch (error) { next(error); }
};
