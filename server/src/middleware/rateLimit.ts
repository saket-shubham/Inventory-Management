import rateLimit from "express-rate-limit";

// Throttles login attempts per IP — the only unauthenticated, credential-
// guessable endpoint in the app. 20 attempts per 15 minutes is generous
// enough for a real person (or a whole shared office IP) fumbling a
// password, while still shutting down a brute-force script.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — please wait a few minutes and try again" },
});
