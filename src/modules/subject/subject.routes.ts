import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./subject.controller";
import { createSubjectSchema, listSubjectsSchema, subjectIdSchema, updateSubjectSchema } from "./subject.dto";

const router = Router();
router.get("/", validate(listSubjectsSchema, "query"), controller.list);
router.post("/", authenticate, allowRoles(UserRole.ADMIN), validate(createSubjectSchema), controller.create);
router.patch("/:id", authenticate, allowRoles(UserRole.ADMIN), validate(subjectIdSchema, "params"), validate(updateSubjectSchema), controller.update);
router.delete("/:id", authenticate, allowRoles(UserRole.ADMIN), validate(subjectIdSchema, "params"), controller.remove);
export default router;
