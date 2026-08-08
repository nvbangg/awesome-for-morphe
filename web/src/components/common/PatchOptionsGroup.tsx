import { memo } from "react";
import { PatchOption } from "@/types/data";

interface PatchOptionsGroupProps {
  options: PatchOption[];
}

export const PatchOptionsGroup = memo(function PatchOptionsGroup({
  options,
}: PatchOptionsGroupProps) {
  if (!options || options.length === 0) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-1 p-2.5 bg-divider/40 border border-border rounded-lg flex flex-col gap-2 select-text"
    >
      {options.map((opt, idx) => (
        <div key={opt.key || idx} className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground">
            {opt.title || opt.key}
          </span>
          {opt.description && (
            <p className="text-xs text-foreground-600 dark:text-foreground-400 leading-normal">
              {opt.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
});
