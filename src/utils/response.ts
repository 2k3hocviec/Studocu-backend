import { Response } from "express";

/** Trả response thành công theo format thống nhất. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

/** Trả response lỗi theo format thống nhất. */
export function sendError(res: Response, message: string, statusCode: number): Response {
  return res.status(statusCode).json({ success: false, message });
}
