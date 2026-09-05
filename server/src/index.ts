import { app } from "./app";
import { env } from "./config/env";
import { sweepExpiredHolds } from "./services/holdExpiry";

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});

// Hold invoices also self-heal on every list/get/process call, so this
// interval just keeps their status current even when nobody is actively
// looking at the Hold section.
sweepExpiredHolds().catch((err) => console.error("Initial hold-expiry sweep failed:", err));
setInterval(() => {
  sweepExpiredHolds().catch((err) => console.error("Hold-expiry sweep failed:", err));
}, 15 * 60 * 1000);
