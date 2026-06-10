import { randomUUID } from "node:crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";

export interface AuthPayload {
  userId: number;
  role: UserRole;
  email: string;
}

export interface TokenPayload extends AuthPayload {
  jti: string;
}

const revokedRefreshTokens = new Set<string>();

/** Ký access token ngắn hạn cho user. */
export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

/** Ký refresh token dài hạn cho user. */
export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

/** Ép payload JWT về cấu trúc token nội bộ. */
function toTokenPayload(decoded: string | JwtPayload): TokenPayload {
  if (typeof decoded === "string" || !decoded.userId || !decoded.role || !decoded.email || !decoded.jti) {
    throw new Error("Invalid token payload");
  }
  return decoded as TokenPayload;
}

/** Xác thực access token. */
export function verifyAccessToken(token: string): TokenPayload {
  return toTokenPayload(jwt.verify(token, env.JWT_ACCESS_SECRET));
}

/** Xác thực refresh token và kiểm tra danh sách đã thu hồi. */
export function verifyRefreshToken(token: string): TokenPayload {
  const payload = toTokenPayload(jwt.verify(token, env.JWT_REFRESH_SECRET));
  if (revokedRefreshTokens.has(payload.jti)) {
    throw new Error("Refresh token has been revoked");
  }
  return payload;
}

/** Thu hồi refresh token hiện tại bằng jti. */
export function revokeRefreshToken(token: string): void {
  const payload = verifyRefreshToken(token);
  revokedRefreshTokens.add(payload.jti);
}
