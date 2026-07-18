import { Link } from "react-router-dom";
import type { Submission } from "../types/api";
import { formatDateTime } from "../lib/derivedStats";
import { submissionLanguageLabel } from "../lib/languages";
import { VerdictBadge } from "./VerdictBadge";

export function SubmissionTable({ submissions }: { submissions: Submission[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="ca-table-head">
          <tr>
            <th className="px-4 py-3">Submission</th>
            <th className="px-4 py-3">Problem</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Language</th>
            <th className="px-4 py-3">Runtime</th>
            <th className="px-4 py-3">Memory</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => {
            const shortId = submission.id.slice(0, 8);
            const problemTitle = submission.problem?.title ?? submission.problemId.slice(0, 8);
            const languageLabel = submissionLanguageLabel(submission);
            const runtimeText = `${submission.runtimeMs ?? "-"} ms`;
            const memoryText = `${submission.memoryKb ?? "-"} KB`;
            const submittedAt = formatDateTime(submission.createdAt);

            return (
              <tr key={submission.id} className="ca-table-row">
                <td className="px-4 py-3 font-mono text-xs">{shortId}</td>
                <td className="px-4 py-3">{problemTitle}</td>
                <td className="px-4 py-3">
                  <VerdictBadge status={submission.status} />
                </td>
                <td className="px-4 py-3">{languageLabel}</td>
                <td className="px-4 py-3">{runtimeText}</td>
                <td className="px-4 py-3">{memoryText}</td>
                <td className="px-4 py-3 text-slate-500">{submittedAt}</td>
                <td className="px-4 py-3">
                  <Link className="text-accent-600" to={`/submissions/${submission.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
