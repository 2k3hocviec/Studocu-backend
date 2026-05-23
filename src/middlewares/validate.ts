import { RequestHandler } from "express";
import { ZodType } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodType, target: Target = "body"): RequestHandler {
  return (req, _res, next) => {
    try {
      (req as unknown as Record<Target, unknown>)[target] = schema.parse(req[target]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
