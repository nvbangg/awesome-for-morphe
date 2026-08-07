import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@heroui/react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  id,
  className = "",
  debounceMs = 150,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange, debounceMs]);

  const handleClear = () => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-foreground-400 pointer-events-none">
        <Search className="size-4" />
      </div>

      <Input
        ref={inputRef}
        id={id}
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-9 bg-background border border-divider rounded-xl text-sm font-medium text-foreground placeholder:text-foreground-400 placeholder:select-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
      />

      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full flex items-center justify-center border-none cursor-pointer transition-colors bg-zinc-200/80 text-zinc-500 hover:text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
