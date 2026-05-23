import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import routes from "./routes";
import { sendSuccess } from "./utils/response";

const app = express();
app.use(cors());
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

const server = app.listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});

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
