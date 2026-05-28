import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

function extensionFromMime(mimetype: string) {
  if (mimetype === "application/pdf") return ".pdf";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return ".pptx";
  return "";
}

function buildPublicId(file: Express.Multer.File) {
  const originalName = file.originalname || "document";
  const dotIndex = originalName.lastIndexOf(".");
  const rawBaseName = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  const rawExtension = dotIndex > 0 ? originalName.slice(dotIndex).toLowerCase() : extensionFromMime(file.mimetype);
  const baseName = rawBaseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";

  return `academic-documents/${baseName}-${Date.now()}${rawExtension}`;
}

export async function uploadDocumentFile(file: Express.Multer.File): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for file uploads", 500);
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: buildPublicId(file),
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError("File upload failed", 500));
          return;
        }
        resolve(result.secure_url);
      },
    );

    upload.end(file.buffer);
  });
}

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
