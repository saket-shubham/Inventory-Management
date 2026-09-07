import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation error", details: err.flatten() });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // body-parser's own error for a request over the express.json() size limit
  // — surfaced as a clear message instead of falling through to a generic 500.
  if (typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "Request is too large — try saving fewer rows/images at once" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
