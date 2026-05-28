import { DocumentType, FileType, StorageProvider } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const listDocumentsSchema = paginationSchema.extend({
  schoolId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  type: z.nativeEnum(DocumentType).optional(),
  search: z.string().optional(),
});
export const documentIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const documentIdParamSchema = z.object({ documentId: z.coerce.number().int().positive() });
const booleanFromForm = z.preprocess(
  (value) => value === "true" ? true : value === "false" ? false : value,
  z.boolean(),
);
export const createDocumentSchema = z.object({
  schoolId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  title: z.string().min(3).max(250),
  description: z.string().max(3000).nullable().optional(),
  documentType: z.nativeEnum(DocumentType),
  isPremium: booleanFromForm.default(false),
  fileUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  originalFilename: z.string().min(1).optional(),
  fileType: z.nativeEnum(FileType),
  fileSize: z.coerce.number().int().positive().optional(),
  totalPages: z.coerce.number().int().positive().optional(),
  storageProvider: z.nativeEnum(StorageProvider).default(StorageProvider.CLOUDINARY),
  previews: z.array(z.object({
    pageNumber: z.number().int().positive(),
    imageUrl: z.string().url(),
    isBlurred: z.boolean().default(false),
  })).optional(),
});
export const updateDocumentSchema = z.object({
  title: z.string().min(3).max(250).optional(),
  description: z.string().max(3000).nullable().optional(),
  documentType: z.nativeEnum(DocumentType).optional(),
  isPremium: z.boolean().optional(),
});
export const rejectDocumentSchema = z.object({ reason: z.string().min(3).max(500) });
