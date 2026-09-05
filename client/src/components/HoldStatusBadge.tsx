import { CheckCircle2, Clock, RotateCcw, TimerOff } from "lucide-react";
import type { HoldStatus } from "../types";

const STATUS_META = {
  active: { label: "Active", className: "status-badge status-hold-active", Icon: Clock },
  completed: { label: "Completed", className: "status-badge status-paid", Icon: CheckCircle2 },
  returned: { label: "Returned", className: "status-badge status-hold-returned", Icon: RotateCcw },
  expired: { label: "Expired", className: "status-badge status-cancelled", Icon: TimerOff },
} as const;

export function HoldStatusBadge({ status }: { status: HoldStatus }) {
  const { label, className, Icon } = STATUS_META[status];
  return (
    <span className={className}>
      <Icon size={12} /> {label}
    </span>
  );
}
