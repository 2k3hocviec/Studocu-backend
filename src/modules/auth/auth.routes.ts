import { Router } from "express";
import { validate } from "../../middlewares/validate";
import * as controller from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.dto";

const router = Router();
router.post("/register", validate(registerSchema), controller.register);
router.post("/verify-email", validate(verifyEmailSchema), controller.verifyEmail);
router.post("/login", validate(loginSchema), controller.login);
router.post("/refresh-token", validate(refreshTokenSchema), controller.refreshToken);
router.post("/forgot-password", validate(forgotPasswordSchema), controller.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), controller.resetPassword);
router.post("/logout", validate(logoutSchema), controller.logout);
export default router;
