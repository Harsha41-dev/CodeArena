import type { LucideIcon } from "lucide-react";

export function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <Icon className="h-4 w-4 text-accent-600" />
      {title}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input className="ca-input mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function NumberInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        className="ca-input mt-1 w-full"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  mono = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <label className="mt-3 block text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        rows={rows}
        className={`ca-textarea mt-1 w-full ${mono ? "font-mono text-xs" : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Checkbox({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Operation({ label, state }: { label: string; state: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950">
      <span>{label}</span>
      <span className="text-xs text-slate-500">{state}</span>
    </div>
  );
}
