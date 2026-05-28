import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { documentService } from "./document.service";

export const list: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await documentService.list(Number(req.query.page), Number(req.query.limit), {
      schoolId: req.query.schoolId ? Number(req.query.schoolId) : undefined,
      subjectId: req.query.subjectId ? Number(req.query.subjectId) : undefined,
      type: req.query.type as never,
      search: req.query.search as string | undefined,
      status: req.query.status as never,
    }, req.user));
  } catch (error) { next(error); }
};
export const detail: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.detail(Number(req.params.id), req.user)); } catch (error) { next(error); }
};
export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.create(req.body, req.user!.userId, req.file), 201); } catch (error) { next(error); }
};
export const update: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.update(Number(req.params.id), req.user!.userId, req.body)); } catch (error) { next(error); }
};
export const remove: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.remove(Number(req.params.id), req.user!.userId, req.user!.role)); } catch (error) { next(error); }
};
export const approve: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.approve(Number(req.params.id), req.user!.userId)); } catch (error) { next(error); }
};
export const reject: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.reject(Number(req.params.id), req.user!.userId, req.body.reason)); } catch (error) { next(error); }
};
export const hide: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.hide(Number(req.params.id), req.user!.userId)); } catch (error) { next(error); }
};
export const unhide: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.unhide(Number(req.params.id), req.user!.userId)); } catch (error) { next(error); }
};
