import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./favorite.controller";
import { favoriteParamsSchema, listFavoritesSchema } from "./favorite.dto";

const router = Router();
router.get("/", authenticate, validate(listFavoritesSchema, "query"), controller.list);
router.post("/:documentId", authenticate, validate(favoriteParamsSchema, "params"), controller.toggle);
export default router;
