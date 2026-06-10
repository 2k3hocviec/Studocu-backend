import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { AppError } from "./errorHandler";

/** Tạo middleware giới hạn route theo role được phép. */
export function allowRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError("Insufficient permissions", 403));
      return;
    }
    next();
  };
}
