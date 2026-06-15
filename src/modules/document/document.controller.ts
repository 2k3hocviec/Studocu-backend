import { RequestHandler } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { sendSuccess } from "../../utils/response";
import { signedCloudinaryRawDownloadUrl } from "../../utils/storage";
import { documentService } from "./document.service";

/** Lấy danh sách tài liệu theo bộ lọc. */
export const list: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await documentService.list(Number(req.query.page), Number(req.query.limit), {
      schoolId: req.query.schoolId ? Number(req.query.schoolId) : undefined,
      subjectId: req.query.subjectId ? Number(req.query.subjectId) : undefined,
      type: req.query.type as never,
      search: req.query.search as string | undefined,
      schoolName: req.query.schoolName as string | undefined,
      subjectName: req.query.subjectName as string | undefined,
      status: req.query.status as never,
    }, req.user));
  } catch (error) { next(error); }
};
/** Lấy chi tiết tài liệu. */
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
/** Tạo tài liệu mới từ form upload. */
export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.create(req.body, req.user!.userId, req.file), 201); } catch (error) { next(error); }
};
/** Cập nhật tài liệu của user. */
export const update: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.update(Number(req.params.id), req.user!.userId, req.body)); } catch (error) { next(error); }
};
/** Xóa mềm tài liệu. */
export const remove: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.remove(Number(req.params.id), req.user!.userId, req.user!.role)); } catch (error) { next(error); }
};
/** Duyệt tài liệu chờ kiểm duyệt. */
export const approve: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.approve(Number(req.params.id), req.user!.userId)); } catch (error) { next(error); }
};
/** Từ chối tài liệu chờ kiểm duyệt. */
export const reject: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.reject(Number(req.params.id), req.user!.userId, req.body.reason)); } catch (error) { next(error); }
};
/** Ẩn tài liệu đã duyệt khỏi khu vực công khai. */
export const hide: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.hide(Number(req.params.id), req.user!.userId)); } catch (error) { next(error); }
};
/** Khôi phục tài liệu đang bị ẩn. */
export const unhide: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.unhide(Number(req.params.id), req.user!.userId)); } catch (error) { next(error); }
};
/** Ghi nhận một lượt tải tài liệu. */
export const recordDownload: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.recordDownload(Number(req.params.id), req.user)); } catch (error) { next(error); }
};

/** Thêm, đổi hoặc xóa reaction của user với tài liệu. */
export const react: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.react(Number(req.params.id), req.user, req.body.type)); } catch (error) { next(error); }
};

/** Mở khóa tài liệu bằng credit. */
export const unlockWithCredit: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await documentService.unlockWithCredit(Number(req.params.id), req.user)); } catch (error) { next(error); }
};

/** Trả file tài liệu được bảo vệ qua proxy backend. */
export const file: RequestHandler = async (req, res, next) => {
  try {
    const fileInfo = await documentService.protectedFile(
      Number(req.params.id),
      req.user,
      req.query.download === "1" || req.query.download === "true",
    );
    const safeFilename = fileInfo.filename.replace(/"/g, "'");


    const remoteFileUrl = signedCloudinaryRawDownloadUrl(fileInfo.fileUrl) ?? fileInfo.fileUrl;
    const upstream = await fetch(remoteFileUrl).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new AppError(`Document file storage request failed: ${message}`, 502);
    });
    if (!upstream.ok) {
      throw new AppError(`Document file unavailable from storage (${upstream.status})`, 502);
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || fileInfo.contentType);
    res.setHeader("Content-Length", body.length);
    res.setHeader("Content-Disposition", `${fileInfo.disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(fileInfo.filename)}`);
    res.send(body);
  } catch (error) { next(error); }
};
