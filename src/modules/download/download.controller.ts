import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { downloadService } from "./download.service";

/** Ghi nhận và trả về thông tin tải tài liệu. */
export const download: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await downloadService.download(req.user!, Number(req.params.documentId))); } catch (error) { next(error); }
};
/** Trả về lịch sử tải tài liệu của user. */
export const history: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await downloadService.history(req.user!.userId, Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};
