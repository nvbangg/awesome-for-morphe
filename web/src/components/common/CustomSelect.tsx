import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { key: string; label: string }[];
  icon: React.ElementType;
  ariaLabel: string;
  className?: string;
}

export function CustomSelect({ value, onChange, options, icon: Icon, ariaLabel, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.key === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className="w-full h-10 px-3 flex items-center justify-between border border-divider rounded-xl bg-background text-sm font-semibold text-foreground hover:bg-default-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
      >
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <Icon className="size-4 shrink-0 text-foreground-500" />
          <span className="truncate">{selectedOption?.label || value}</span>
        </div>
        <ChevronDown className={`size-4 text-foreground-500 shrink-0 ml-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-divider rounded-xl shadow-xl z-50 p-1 flex flex-col divide-y divide-divider/40">
          {options.map((option) => {
            const isSelected = option.key === value;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onChange(option.key);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm font-medium rounded-lg text-left cursor-pointer transition-colors flex items-center justify-between whitespace-normal wrap-break-word ${
                  isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="text-xs text-primary font-bold ml-2">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
