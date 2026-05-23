import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function pagination(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
