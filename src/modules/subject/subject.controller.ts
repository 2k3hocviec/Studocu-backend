import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { subjectService } from "./subject.service";

/** Lấy danh sách môn học. */
export const list: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await subjectService.list(
        Number(req.query.page),
        Number(req.query.limit),
        req.query.schoolId ? Number(req.query.schoolId) : undefined,
        req.query.search as string | undefined,
      ),
    );
  } catch (error) {
    next(error);
  }
};

/** Tạo môn học mới. */
export const create: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await subjectService.create(req.body), 201);
  } catch (error) {
    next(error);
  }
};

/** Cập nhật thông tin môn học. */
export const update: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await subjectService.update(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
};

/** Xóa mềm môn học. */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await subjectService.remove(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
};
