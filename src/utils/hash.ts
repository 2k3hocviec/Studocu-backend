import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/** Hash mật khẩu trước khi lưu database. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** So sánh mật khẩu thô với hash đã lưu. */
export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
