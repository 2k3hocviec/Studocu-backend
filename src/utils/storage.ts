import { randomUUID } from "node:crypto";

import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";


/** Suy ra extension file từ MIME type upload. */
function extensionFromMime(mimetype: string) {
  if (mimetype === "application/pdf") return ".pdf";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return ".pptx";
  return "";
}

/** Tạo tên file local duy nhất cho tài liệu upload. */
function localDocumentFileName(file: Express.Multer.File) {
  const extension = extensionFromMime(file.mimetype) || path.extname(file.originalname || "").toLowerCase();
  return `${Date.now()}-${randomUUID()}${extension}`;
}

/** Lưu file tài liệu vào Cloudinary và trả URL nội bộ. */
export async function uploadDocumentFile(file: Express.Multer.File): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for document uploads", 500);
  }

  const filename = localDocumentFileName(file);

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "documents",
        public_id: filename,
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError("Document file upload failed", 500));
          return;
        }
        resolve(result.secure_url);
      },
    );

    upload.end(file.buffer);
  });
}


/** Tạo signed URL tạm thời để tải file raw riêng tư trên Cloudinary. */
export function signedCloudinaryRawDownloadUrl(fileUrl: string) {
  if (!env.CLOUDINARY_URL) return null;

  try {
    const parsed = new URL(fileUrl);
    const marker = "/raw/upload/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (!parsed.hostname.endsWith("res.cloudinary.com") || markerIndex < 0) return null;

    const rawPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    const publicId = rawPath.replace(/^v\d+\//, "");
    if (!publicId) return null;

    const extension = path.extname(publicId).replace(".", "");
    return cloudinary.utils.private_download_url(publicId, extension, {
      resource_type: "raw",
      type: "upload",
      attachment: false,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });
  } catch {
    return null;
  }
}


/** Upload ảnh preview tài liệu lên Cloudinary. */
export async function uploadDocumentPreviewImage(buffer: Buffer, batchId: string, pageNumber: number): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for preview uploads", 500);
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: `academic-document-previews/${batchId}`,
        public_id: `page-${pageNumber}`,
        format: "png",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError("Preview image upload failed", 500));
          return;
        }
        resolve(result.secure_url);
      },
    );

    upload.end(buffer);
  });
}

/** Upload avatar PNG lên Cloudinary và crop theo khuôn mặt. */
export async function uploadAvatarImage(file: Express.Multer.File, userId: number): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for avatar uploads", 500);
  }
  if (file.mimetype !== "image/png") {
    throw new AppError("Avatar must be a PNG image", 400);
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "user-avatars",
        public_id: `${userId}-${Date.now()}`,
        format: "png",
        overwrite: true,
        transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError("Avatar upload failed", 500));
          return;
        }
        resolve(result.secure_url);
      },
    );

    upload.end(file.buffer);
  });
}
