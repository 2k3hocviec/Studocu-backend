import { UserRole } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { authenticate, optionalAuth } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./document.controller";
import { createDocumentSchema, documentIdSchema, listDocumentsSchema, rejectDocumentSchema, updateDocumentSchema } from "./document.dto";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();
router.get("/", optionalAuth, validate(listDocumentsSchema, "query"), controller.list);
router.get("/:id", optionalAuth, validate(documentIdSchema, "params"), controller.detail);
router.post("/", authenticate, upload.single("file"), validate(createDocumentSchema), controller.create);
router.patch("/:id", authenticate, validate(documentIdSchema, "params"), validate(updateDocumentSchema), controller.update);
router.delete("/:id", authenticate, validate(documentIdSchema, "params"), controller.remove);
router.patch("/:id/approve", authenticate, allowRoles(UserRole.ADMIN, UserRole.MODERATOR), validate(documentIdSchema, "params"), controller.approve);
router.patch("/:id/reject", authenticate, allowRoles(UserRole.ADMIN, UserRole.MODERATOR), validate(documentIdSchema, "params"), validate(rejectDocumentSchema), controller.reject);
export default router;
