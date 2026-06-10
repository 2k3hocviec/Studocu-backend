import { UserRole } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./user.controller";
import { changePasswordSchema, listUsersSchema, recentDocumentsSchema, updateProfileSchema, updateStatusSchema, userIdSchema } from "./user.dto";

const router = Router();
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get("/me", authenticate, controller.getMe);
router.patch("/me", authenticate, validate(updateProfileSchema), controller.updateMe);
router.patch("/me/avatar", authenticate, avatarUpload.single("avatar"), controller.updateAvatar);
router.patch("/me/password", authenticate, validate(changePasswordSchema), controller.changePassword);
router.get("/me/documents", authenticate, controller.myDocuments);
router.get("/me/recent-documents", authenticate, validate(recentDocumentsSchema, "query"), controller.recentDocuments);
router.get("/", authenticate, allowRoles(UserRole.ADMIN), validate(listUsersSchema, "query"), controller.list);
router.patch("/:id/status", authenticate, allowRoles(UserRole.ADMIN), validate(userIdSchema, "params"), validate(updateStatusSchema), controller.updateStatus);
export default router;
