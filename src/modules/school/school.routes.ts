import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import * as controller from "./school.controller";
import { createSchoolSchema, listSchoolsSchema, schoolIdSchema, updateSchoolSchema } from "./school.dto";

const router = Router();
router.get("/", validate(listSchoolsSchema, "query"), controller.list);
router.post("/", authenticate, allowRoles(UserRole.ADMIN), validate(createSchoolSchema), controller.create);
router.patch("/:id", authenticate, allowRoles(UserRole.ADMIN), validate(schoolIdSchema, "params"), validate(updateSchoolSchema), controller.update);
router.delete("/:id", authenticate, allowRoles(UserRole.ADMIN), validate(schoolIdSchema, "params"), controller.remove);
export default router;
