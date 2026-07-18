import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  onPageChange
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const safeTotal = totalPages < 1 ? 1 : totalPages;
  const canPrev = page > 1;
  const canNext = page < safeTotal;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">
        Page {page} of {safeTotal}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={!canPrev}
          onClick={() => {
            if (canPrev) onPageChange(page - 1);
          }}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button
          variant="secondary"
          disabled={!canNext}
          onClick={() => {
            if (canNext) onPageChange(page + 1);
          }}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
