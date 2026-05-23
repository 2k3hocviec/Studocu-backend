import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { AppError } from "./errorHandler";
import { verifyAccessToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: { userId: number; role: UserRole; email: string };
    }
  }
}

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(new AppError("Invalid access token", 401));
  }
};

export const authenticate: RequestHandler = (req, _res, next) => {
  optionalAuth(req, _res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }
    next();
  });
};
