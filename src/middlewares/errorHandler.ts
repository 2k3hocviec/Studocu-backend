import { ErrorRequestHandler } from "express";
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
  console.error(error);
  sendError(res, "Internal server error", 500);
};
