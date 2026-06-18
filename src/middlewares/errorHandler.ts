import { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { sendError } from "../utils/response";
import { DocumentMimeError } from "../utils/uploadFilter";

/** Lỗi chủ động có HTTP status code rõ ràng. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Chuẩn hóa mọi lỗi thành response JSON. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode);
    return;
  }
  if (error instanceof ZodError) {
    sendError(res, error.issues.map((issue) => issue.message).join(", "), 400);
    return;
  }
  if (error instanceof DocumentMimeError) {
    sendError(res, error.message, error.status);
    return;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      sendError(res, "File tối đa 20MB.", 400);
      return;
    }
    if (error.field === "file" || error.code === "LIMIT_UNEXPECTED_FILE") {
      const cause = error.message;
      sendError(res, cause || "File không hợp lệ.", 400);
      return;
    }
    sendError(res, error.message, 400);
    return;
  }
  console.error(error);
  sendError(res, "Internal server error", 500);
};
