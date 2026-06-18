import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import routes from "./routes";
import { sendSuccess } from "./utils/response";

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return origin.trim().replace(/\/+$/, "");
  }
}

function expandOriginVariants(origin: string) {
  const variants = new Set([origin]);

  try {
    const url = new URL(origin);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      variants.add(`${url.protocol}//${url.host}`);
    } else {
      url.hostname = `www.${url.hostname}`;
      variants.add(`${url.protocol}//${url.host}`);
    }
  } catch {
    // Ignore invalid URLs here; env validation handles the required shape.
  }

  return variants;
}

const allowedOrigins = new Set(
  env.FRONTEND_URL.split(",")
    .map(normalizeOrigin)
    .filter(Boolean)
    .flatMap((origin) => [...expandOriginVariants(origin)]),
);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const requestOrigin = origin ? normalizeOrigin(origin) : undefined;
    if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition"],
};

const app = express();
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (_req, res) => sendSuccess(res, { message: "Academic Documents API is running" }));
app.get("/api/v1", (_req, res) =>
  sendSuccess(res, {
    message: "API v1",
    routes: [
      "/auth",
      "/users",
      "/schools",
      "/subjects",
      "/documents",
      "/downloads",
      "/favorites",
      "/reports",
      "/subscriptions",
      "/payments",
      "/credits",
    ],
  }),
);
app.use("/api/v1", routes);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, env.HOST, () => {
  const displayHost = env.HOST === "0.0.0.0" ? "localhost" : env.HOST;
  console.log(`Server is running on http://${displayHost}:${env.PORT}`);
});

/** Đóng server khi process nhận tín hiệu dừng. */
async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down server.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export default app;
