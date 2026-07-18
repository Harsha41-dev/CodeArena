export function ProgressRing({ value, label }: { value: number; label: string }) {
  // clamp between 0 and 100
  let normalized = value;
  if (normalized < 0) {
    normalized = 0;
  }
  if (normalized > 100) {
    normalized = 100;
  }

  // 100% = 360deg so multiply by 3.6
  const degrees = normalized * 3.6;
  const background = `conic-gradient(var(--ca-accent) ${degrees}deg, var(--ca-panel-muted) 0deg)`;

  return (
    <div className="flex items-center gap-3">
      <div className="grid h-16 w-16 place-items-center rounded-full" style={{ background }}>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-semibold dark:bg-slate-900">
          {normalized}%
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">completion</p>
      </div>
    </div>
  );
}
