import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

/** Suy ra resource_type Cloudinary phù hợp với định dạng tài liệu. */
function cloudinaryResourceType(mimetype: string, filename: string): "raw" | "image" {
  const lower = `${mimetype} ${filename}`.toLowerCase();
  if (lower.includes("pdf") || lower.includes("officedocument") || lower.endsWith(".docx") || lower.endsWith(".pptx")) {
    return "raw";
  }
  return "image";
}

/** Trích extension từ tên file gốc (không bao gồm dấu chấm, chữ thường). */
function fileExtension(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}

/** Upload file tài liệu gốc (PDF/DOCX/PPTX) lên Cloudinary. */
export async function uploadDocumentFile(file: Express.Multer.File): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required to upload documents", 500);
  }
  const resourceType = cloudinaryResourceType(file.mimetype, file.originalname || "");
  const format = fileExtension(file.originalname || "");
  const publicId = `academic-documents/${Date.now()}-${randomUUID()}`;
  return new Promise<string>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: publicId,
        folder: undefined,
        use_filename: false,
        unique_filename: false,
        ...(format ? { format } : {}),
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(`Document file upload failed: ${error?.message ?? "unknown error"}`, 500));
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

    const lastDotIndex = publicId.lastIndexOf(".");
    const extension = lastDotIndex >= 0 ? publicId.slice(lastDotIndex + 1) : "";
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

/** Trích public_id từ URL Cloudinary (raw hoặc image). Trả null nếu URL không phải Cloudinary. */
function cloudinaryPublicIdFromUrl(fileUrl: string): { publicId: string; resourceType: "raw" | "image" } | null {
  try {
    const parsed = new URL(fileUrl);
    if (!parsed.hostname.endsWith("res.cloudinary.com")) return null;

    const rawMarker = "/raw/upload/";
    const imageMarker = "/image/upload/";
    if (parsed.pathname.includes(rawMarker)) {
      const rawPath = decodeURIComponent(parsed.pathname.slice(parsed.pathname.indexOf(rawMarker) + rawMarker.length));
      const publicId = rawPath.replace(/^v\d+\//, "");
      if (!publicId) return null;
      return { publicId, resourceType: "raw" };
    }
    if (parsed.pathname.includes(imageMarker)) {
      const imagePath = decodeURIComponent(parsed.pathname.slice(parsed.pathname.indexOf(imageMarker) + imageMarker.length));
      const publicId = imagePath.replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
      if (!publicId) return null;
      return { publicId, resourceType: "image" };
    }
    return null;
  } catch {
    return null;
  }
}

/** Xóa file trên Cloudinary theo URL. Không throw nếu URL không phải Cloudinary hoặc xóa lỗi. */
export async function deleteCloudinaryAsset(fileUrl: string): Promise<void> {
  if (!env.CLOUDINARY_URL || !fileUrl) return;
  const parsed = cloudinaryPublicIdFromUrl(fileUrl);
  if (!parsed) return;

  try {
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType,
      invalidate: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new AppError(`Cloudinary delete failed: ${message}`, 502);
  }
}

/** Upload ảnh preview tài liệu lên Cloudinary. */
export async function uploadDocumentPreviewImage(buffer: Buffer, publicId: string): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for preview uploads", 500);
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
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
        public_id: `user-avatars/${userId}-${Date.now()}`,
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

/** Upload buffer PDF (DOCX/PPTX đã convert) lên Cloudinary. */
export async function uploadConvertedPdfBuffer(buffer: Buffer): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required to upload converted PDFs", 500);
  }
  const publicId = `academic-documents-pdf/${Date.now()}-${randomUUID()}`;
  return new Promise<string>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        folder: undefined,
        use_filename: false,
        unique_filename: false,
        format: "pdf",
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(`Converted PDF upload failed: ${error?.message ?? "unknown error"}`, 500));
          return;
        }
        resolve(result.secure_url);
      },
    );
    upload.end(buffer);
  });
}
