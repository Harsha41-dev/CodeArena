// simple pulse rows while a list is loading
export function LoadingSkeleton({ rows = 6 }: { rows?: number }) {
  const items: number[] = [];
  for (let i = 0; i < rows; i++) {
    items.push(i);
  }

  return (
    <div className="space-y-3 p-5">
      {items.map((index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}
