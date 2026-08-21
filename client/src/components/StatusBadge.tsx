import { Ban, CheckCircle2, FileClock } from "lucide-react";

const STATUS_META = {
  paid: { label: "Paid", className: "status-badge status-paid", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "status-badge status-cancelled", Icon: Ban },
  draft: { label: "Draft", className: "status-badge status-draft", Icon: FileClock },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_META }) {
  const { label, className, Icon } = STATUS_META[status];
  return (
    <span className={className}>
      <Icon size={12} /> {label}
    </span>
  );
}
