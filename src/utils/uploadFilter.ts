import { FileType } from "@prisma/client";
import type multer from "multer";

/** MIME type được phép — dùng cho fileFilter Multer để chặn sớm các file không hợp lệ. */
export const ALLOWED_MIME_TYPES: Readonly<Record<FileType, readonly string[]>> = {
  PDF: [
    "application/pdf",
  ],
  DOCX: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  PPTX: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

/** Extension (không dấu chấm, chữ thường) được phép. */
export const ALLOWED_EXTENSIONS: Readonly<Record<FileType, readonly string[]>> = {
  PDF: ["pdf"],
  DOCX: ["docx"],
  PPTX: ["pptx"],
};

/** Lấy extension từ tên file (chữ thường, không dấu chấm). Trả về "" nếu không có. */
export function getFileExtension(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}

/** Map extension → FileType, hoặc null nếu extension không hợp lệ. */
export function fileTypeFromExtension(filename: string): FileType | null {
  const ext = getFileExtension(filename);
  for (const [type, exts] of Object.entries(ALLOWED_EXTENSIONS) as Array<[FileType, readonly string[]]>) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

/** Kiểm tra MIME type có thuộc FileType không. */
export function isAllowedMime(mime: string, type: FileType): boolean {
  return ALLOWED_MIME_TYPES[type].includes(mime);
}

/**
 * fileFilter cho Multer:
 * - Dựa trên extension tên file (do user/client gửi) thay vì MIME type (có thể bị spoof).
 * - Nếu extension hợp lệ → nhận file. Magic bytes check chính xác sẽ chạy ở service layer.
 * - Nếu extension không hợp lệ → từ chối ngay, không tốn RAM nhận file.
 */
export function documentFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback,
): void {
  const detected = fileTypeFromExtension(file.originalname || "");
  if (!detected) {
    callback(new DocumentMimeError(
      `Định dạng file không được hỗ trợ. Vui lòng chọn file .pdf, .docx hoặc .pptx.`,
    ));
    return;
  }
  // Nếu MIME cũng có, kiểm tra khớp với extension. Nếu MIME rỗng / unknown → bỏ qua (vẫn để magic bytes check ở service).
  if (file.mimetype && file.mimetype !== "application/octet-stream" && !isAllowedMime(file.mimetype, detected)) {
    callback(new DocumentMimeError(
      `MIME type không khớp với đuôi file. Vui lòng kiểm tra lại file.`,
    ));
    return;
  }
  callback(null, true);
}

/** Lỗi MIME/extension không hợp lệ — multer sẽ chuyển sang errorHandler. */
export class DocumentMimeError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "DocumentMimeError";
  }
}
