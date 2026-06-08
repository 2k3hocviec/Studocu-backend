import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

const LOCAL_DOCUMENT_PREFIX = "local://documents/";
const LOCAL_DOCUMENT_DIR = path.resolve(process.cwd(), "uploads", "documents");

function extensionFromMime(mimetype: string) {
  if (mimetype === "application/pdf") return ".pdf";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return ".pptx";
  return "";
}

function localDocumentFileName(file: Express.Multer.File) {
  const extension = extensionFromMime(file.mimetype) || path.extname(file.originalname || "").toLowerCase();
  return `${Date.now()}-${randomUUID()}${extension}`;
}

export async function uploadDocumentFile(file: Express.Multer.File): Promise<string> {
  await mkdir(LOCAL_DOCUMENT_DIR, { recursive: true });
  const filename = localDocumentFileName(file);
  await writeFile(path.join(LOCAL_DOCUMENT_DIR, filename), file.buffer);
  return `${LOCAL_DOCUMENT_PREFIX}${encodeURIComponent(filename)}`;
}

export function isLocalDocumentUrl(fileUrl: string) {
  return fileUrl.startsWith(LOCAL_DOCUMENT_PREFIX);
}

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

export async function readLocalDocumentFile(fileUrl: string): Promise<Buffer> {
  if (!isLocalDocumentUrl(fileUrl)) {
    throw new AppError("Unsupported local document URL", 500);
  }

  const filename = decodeURIComponent(fileUrl.slice(LOCAL_DOCUMENT_PREFIX.length));
  if (!filename || filename !== path.basename(filename)) {
    throw new AppError("Invalid local document path", 500);
  }

  try {
    return await readFile(path.join(LOCAL_DOCUMENT_DIR, filename));
  } catch {
    throw new AppError("Document file is missing from local storage", 404);
  }
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
