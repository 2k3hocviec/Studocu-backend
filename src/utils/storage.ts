import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

export async function uploadDocumentFile(file: Express.Multer.File): Promise<string> {
  if (!env.CLOUDINARY_URL) {
    throw new AppError("CLOUDINARY_URL is required for file uploads", 500);
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { resource_type: "raw", folder: "academic-documents" },
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
