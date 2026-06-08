import { DocumentStatus, DocumentType, FileType, ReactionType, StorageProvider } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const listDocumentsSchema = paginationSchema.extend({
  schoolId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  type: z.nativeEnum(DocumentType).optional(),
  search: z.string().optional(),
  schoolName: z.string().trim().optional(),
  subjectName: z.string().trim().optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
});
export const documentIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const documentIdParamSchema = z.object({ documentId: z.coerce.number().int().positive() });
const optionalPositiveInt = z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().positive().optional());
const optionalName = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(2).max(150).optional(),
);

export const createDocumentSchema = z.object({
  schoolId: optionalPositiveInt,
  subjectId: optionalPositiveInt,
  requestedSchoolName: optionalName,
  requestedSubjectName: optionalName,
  title: z.string().min(3).max(250),
  description: z.string().max(3000).nullable().optional(),
  documentType: z.nativeEnum(DocumentType),
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
}).superRefine((data, ctx) => {
  if (!data.schoolId && !data.requestedSchoolName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["requestedSchoolName"], message: "Vui lòng chọn hoặc nhập trường học." });
  }
  if (!data.subjectId && !data.requestedSubjectName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["requestedSubjectName"], message: "Vui lòng chọn hoặc nhập môn học." });
  }
});
export const updateDocumentSchema = z.object({
  title: z.string().min(3).max(250).optional(),
  description: z.string().max(3000).nullable().optional(),
  documentType: z.nativeEnum(DocumentType).optional(),
});
export const rejectDocumentSchema = z.object({ reason: z.string().min(3).max(500) });
export const reactionSchema = z.object({ type: z.nativeEnum(ReactionType).nullable() });
