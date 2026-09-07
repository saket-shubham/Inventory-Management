import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export const app = express();

// Needed for express-rate-limit to see the real client IP (not the proxy's)
// once this sits behind a reverse proxy like Render/Railway/Nginx — without
// this, every request looks like it comes from the same IP and either
// everyone gets rate-limited together, or the limiter refuses to start.
app.set("trust proxy", 1);

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
// Default 100kb is too small for Bulk Add Products — each product photo can
// be up to ~50KB before base64 overhead, and a batch of a few products with
// photos in one request easily exceeds the default.
app.use(express.json({ limit: "10mb" }));
app.use(morgan(env.appEnv === "development" ? "dev" : "combined"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);
