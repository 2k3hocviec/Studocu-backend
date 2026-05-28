import { RequestHandler } from "express";
import { ZodType } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodType, target: Target = "body"): RequestHandler {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req[target]);
      if (target === "query") {
        Object.defineProperty(req, "query", {
          value: parsed,
          configurable: true,
          enumerable: true,
          writable: true,
        });
      } else {
        (req as unknown as Record<Target, unknown>)[target] = parsed;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
