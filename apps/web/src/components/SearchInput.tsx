import { Search } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    onChange(next);
  }

  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input className="ca-input w-full pl-9" placeholder={placeholder} value={value} onChange={handleChange} />
    </div>
  );
}
