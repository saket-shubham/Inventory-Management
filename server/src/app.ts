import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export const app = express();

const localhostPattern = /^http:\/\/localhost:\d+$/;

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header), any configured
      // origin, and — in development — any localhost port so Vite's fallback
      // ports (5173, 5174, ...) work without reconfiguring CORS_ORIGIN each time.
      if (!origin || env.corsOrigins.includes(origin) || (env.appEnv === "development" && localhostPattern.test(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());
app.use(morgan(env.appEnv === "development" ? "dev" : "combined"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);
