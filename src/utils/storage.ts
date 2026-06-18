import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { FileType } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

/** Thư mục gốc trên Cloudinary. Mọi asset upload mới sẽ nằm dưới prefix này. */
function rootFolder() {
  return (env.CLOUDINARY_ROOT_FOLDER || "studocu").replace(/^\/+|\/+$/g, "");
}

/** Sub-folder trong originals/ tương ứng với FileType. */
function originalsSubfolder(fileType: FileType): "pdf" | "docx" | "pptx" {
  switch (fileType) {
    case "PDF":
      return "pdf";
    case "DOCX":
      return "docx";
    case "PPTX":
      return "pptx";
    default:
      throw new AppError(`Unsupported file type for storage: ${String(fileType)}`, 400);
  }
}

/** Trích extension (chữ thường, không dấu chấm) từ tên file gốc. */
function fileExtension(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}

/** Sinh public_id cho file gốc theo cấu trúc mới. */
function buildOriginalPublicId(documentId: number, fileType: FileType, filename: string) {
  const ext = fileExtension(filename);
  return {
    publicId: `${rootFolder()}/originals/${originalsSubfolder(fileType)}/${documentId}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    format: ext || undefined,
  };
}

/** Sinh public_id cho file PDF đã convert từ DOCX/PPTX. */
function buildConvertedPublicId(documentId: number) {
  return {
    publicId: `${rootFolder()}/converted/pdf/${documentId}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    format: "pdf" as const,
  };
}

/** Sinh public_id cho ảnh preview. */
function buildPreviewPublicId(documentId: number, pageNumber: number) {
  return `${rootFolder()}/previews/${documentId}/page-${pageNumber}`;
}

/** Tags gắn lên asset để search/group trên Cloudinary dashboard. */
function documentTags(documentId: number, fileType: FileType | "converted" | "preview") {
  const tags = ["studocu", `doc:${documentId}`];
  if (fileType === "converted") tags.push("doctype:converted");
  else if (fileType === "preview") tags.push("doctype:preview");
  else tags.push(`doctype:${fileType.toLowerCase()}`);
  return tags;
}

/** Upload file gốc (PDF/DOCX/PPTX) lên Cloudinary — gom theo originals/{fileType}/. */
export async function uploadDocumentFile(
  file: Express.Multer.File,
  fileType: FileType,
  documentId: number,
): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required to upload documents", 500);
  }

  const { publicId, format } = buildOriginalPublicId(documentId, fileType, file.originalname || "");

  return new Promise<string>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        folder: undefined,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        tags: documentTags(documentId, fileType),
        context: {
          documentId: String(documentId),
          fileType,
          originalName: (file.originalname || "").slice(0, 200),
        },
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

/** Upload buffer PDF (DOCX/PPTX đã convert) — gom vào converted/pdf/. */
export async function uploadConvertedPdfBuffer(buffer: Buffer, documentId: number): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required to upload converted PDFs", 500);
  }

  const { publicId, format } = buildConvertedPublicId(documentId);

  return new Promise<string>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        folder: undefined,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        tags: documentTags(documentId, "converted"),
        context: {
          documentId: String(documentId),
          source: "office-convert",
        },
        format,
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

/** Upload ảnh preview tài liệu lên Cloudinary — gom theo previews/{documentId}/. */
export async function uploadDocumentPreviewImage(
  buffer: Buffer,
  documentId: number,
  pageNumber: number,
): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for preview uploads", 500);
  }

  const publicId = buildPreviewPublicId(documentId, pageNumber);

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
        folder: undefined,
        format: "png",
        overwrite: true,
        tags: documentTags(documentId, "preview"),
        context: {
          documentId: String(documentId),
          pageNumber: String(pageNumber),
        },
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

/** Trích public_id + resource_type từ URL Cloudinary. Tổng quát cho cả folder cũ và mới. */
function cloudinaryPublicIdFromUrl(fileUrl: string): { publicId: string; resourceType: "raw" | "image" } | null {
  try {
    const parsed = new URL(fileUrl);
    if (!parsed.hostname.endsWith("res.cloudinary.com")) return null;

    const rawMarker = "/raw/upload/";
    const imageMarker = "/image/upload/";

    if (parsed.pathname.includes(rawMarker)) {
      const rawPath = decodeURIComponent(
        parsed.pathname.slice(parsed.pathname.indexOf(rawMarker) + rawMarker.length),
      );
      const publicId = rawPath.replace(/^v\d+\//, "");
      if (!publicId) return null;
      return { publicId, resourceType: "raw" };
    }

    if (parsed.pathname.includes(imageMarker)) {
      const imagePath = decodeURIComponent(
        parsed.pathname.slice(parsed.pathname.indexOf(imageMarker) + imageMarker.length),
      );
      const publicId = imagePath.replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
      if (!publicId) return null;
      return { publicId, resourceType: "image" };
    }

    return null;
  } catch {
    return null;
  }
}

/** Xóa 1 file Cloudinary theo URL. Không throw nếu URL không phải Cloudinary hoặc xóa lỗi. */
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

/**
 * Xóa TOÀN BỘ asset của 1 document (file gốc + converted PDF + tất cả preview) bằng tag `doc:{id}`.
 * An toàn cho cả asset folder cũ và folder mới vì mọi asset upload qua helper này đều được tag `doc:{id}`.
 */
export async function deleteAllDocumentAssets(documentId: number): Promise<void> {
  if (!env.CLOUDINARY_URL) return;
  const tag = `doc:${documentId}`;

  try {
    await cloudinary.api.delete_resources_by_tag(tag, { resource_type: "raw", invalidate: true });
    await cloudinary.api.delete_resources_by_tag(tag, { resource_type: "image", invalidate: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new AppError(`Cloudinary bulk delete failed for document ${documentId}: ${message}`, 502);
  }
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
    const baseId = extension && publicId.endsWith(`.${extension}`) ? publicId.slice(0, -extension.length - 1) : publicId;
    return cloudinary.url(baseId, {
      resource_type: "raw",
      type: "upload",
      format: extension || undefined,
      sign_url: false,
    });
  } catch {
    return null;
  }
}

/** Upload avatar PNG lên Cloudinary và crop theo khuôn mặt. */
export async function uploadAvatarImage(file: Express.Multer.File, userId: number): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required to upload avatars", 500);
  }
  if (file.mimetype !== "image/png") {
    throw new AppError("Avatar must be a PNG image", 400);
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: `${rootFolder()}/user-avatars/${userId}-${Date.now()}`,
        folder: undefined,
        format: "png",
        overwrite: true,
        tags: ["studocu", "avatar", `user:${userId}`],
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
