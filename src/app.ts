import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import routes from "./routes";
import { sendSuccess } from "./utils/response";

const allowedOrigins = env.FRONTEND_URL.split(",").map((origin) => origin.trim()).filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
