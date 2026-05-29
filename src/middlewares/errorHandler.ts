import { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { sendError } from "../utils/response";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode);
    return;
  }
  if (error instanceof ZodError) {
    sendError(res, error.issues.map((issue) => issue.message).join(", "), 400);
    return;
  }
  if (error instanceof multer.MulterError) {
    sendError(res, error.code === "LIMIT_FILE_SIZE" ? "File avatar tối đa 2MB." : error.message, 400);
    return;
  }
  console.error(error);
  sendError(res, "Internal server error", 500);
};
