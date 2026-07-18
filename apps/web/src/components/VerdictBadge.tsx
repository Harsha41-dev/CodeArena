import { Badge } from "./Badge";
import type { SubmissionStatus } from "../types/api";
import { formatStatus, verdictClass } from "../lib/status";

export function VerdictBadge({ status }: { status: SubmissionStatus }) {
  const className = verdictClass(status);
  const label = formatStatus(status);
  return <Badge className={className}>{label}</Badge>;
}
