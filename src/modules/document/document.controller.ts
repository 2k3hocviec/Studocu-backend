import { RequestHandler } from "express";
import { AppError } from "../../middlewares/errorHandler";
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
  try {
    sendSuccess(
      res,
      await documentService.detail(
        Number(req.params.id),
        req.user,
        req.query.preview === "1" || req.query.preview === "true",
      ),
    );
  } catch (error) { next(error); }
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
export const unlockFullAccess: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.unlockFullAccess(Number(req.params.id), req.user)); } catch (error) { next(error); }
};
export const recordDownload: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.recordDownload(Number(req.params.id), req.user)); } catch (error) { next(error); }
};

export const react: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.react(Number(req.params.id), req.user, req.body.type)); } catch (error) { next(error); }
};

export const file: RequestHandler = async (req, res, next) => {
  try {
    const fileInfo = await documentService.protectedFile(
      Number(req.params.id),
      req.user,
      req.query.download === "1" || req.query.download === "true",
    );
    const upstream = await fetch(fileInfo.fileUrl);
    if (!upstream.ok) {
      throw new AppError("Document file unavailable", 502);
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    const safeFilename = fileInfo.filename.replace(/"/g, "'");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || fileInfo.contentType);
    res.setHeader("Content-Length", body.length);
    res.setHeader("Content-Disposition", `${fileInfo.disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(fileInfo.filename)}`);
    res.send(body);
  } catch (error) { next(error); }
};
