import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const favoriteParamsSchema = z.object({ documentId: z.coerce.number().int().positive() });
export const listFavoritesSchema = paginationSchema;
